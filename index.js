"use strict";

var mysql = require("mysql");
var Excel = require("exceljs");
var loadSQLFile = global.libUtils.loadSQLFile;
var Execution = global.ExecutionClass;

class mysqlExecutor extends Execution {
  constructor(process) {
    super(process);
  }

  exec(params) {
    var _this = this;
    var endOptions = {end: "end"};

    function executeQuery(values) {

      return new Promise(async function (resolve, reject) {
        var options = {
          useExtraValue: values.args || false,
          useProcessValues: true,
          useGlobalValues: true,
          altValueReplace: "null"
        };

        var _query = await _this.paramsReplace(values.command, options);
        endOptions.command_executed = _query;

        var connection = mysql.createConnection({
          host: values.host,
          socketPath: values.socketPath,
          port: values.port,
          ssl: values.ssl,
          user: values.user,
          password: values.password,
          database: values.database,
          multipleStatements: values.multipleStatements || true,
          charset: values.charset,
          timezone: values.timezone,
          insecureAuth: values.insecureAuth,
          debug: values.debug,
          connectTimeout: values.connectTimeout || 30000,
        });

        connection.connect(function (err) {
          if (err) {
            reject(`Error connecting Mysql: ${err}`);
          } else {
            connection.query(_query, null, function (err, results) {
              if (err) {
                reject(`executeMysql query ${_query}: ${err}`);
              } else {
                resolve(results);
              }
              connection.end();
            });
          }
        });
      });
    }

    function evaluateResults(results) {
      if (results instanceof Array) {

        if (params.xlsxFileExport || params.csvFileExport){
          let author = "Runnerty";
          let sheetName = "Sheet";

          if (params.xlsxAuthorName){
            author = params.xlsxAuthorName;
          }

          if (params.xlsxSheetName){
            sheetName = params.xlsxSheetName;
          }

          let workbook = new Excel.Workbook();
          let sheet = workbook.addWorksheet(sheetName);
          workbook.creator = author;
          workbook.lastPrinted = new Date();

          let columns = [];
          if (results.length){
            for (var i = 0; i < Object.keys(results[0]).length; i++){
              columns.push({
                header: Object.keys(results[0])[i],
                key: Object.keys(results[0])[i],
                width: 30
              });
            }
            sheet.columns = columns;
            sheet.addRows(results);
          }

          if (params.xlsxFileExport){
            workbook.xlsx.writeFile(params.xlsxFileExport).then(function(err, data) {
              if (err){
                _this.logger.log("error", `Generating xlsx: ${err}. Results: ${results}`);
              }
            });
          }

          if (params.csvFileExport){
            workbook.csv.writeFile(params.csvFileExport).then(function(err, data) {
              if (err){
                _this.logger.log("error", `Generating csv: ${err}. Results: ${results}`);
              }
            });
          }
        }
        //STANDARD OUPUT:
        endOptions.data_output = results;
        endOptions.msg_output = results.message || "";
        //EXTRA DATA OUTPUT:
        endOptions.extra_output = {};
        endOptions.extra_output.db_countRows = results.length;
        endOptions.extra_output.db_firstRow = JSON.stringify(results[0]);
        if (results[0] instanceof Object) {
          let keys = Object.keys(results[0]);
          let keysLength = keys.length;
          while (keysLength--) {
            let key = keys[keysLength];
            endOptions.extra_output["db_firstRow_"+key] = results[0][key];
          }
        }

        _this.end(endOptions);

      } else {

        if (results instanceof Object) {
          endOptions.data_output = "";
          endOptions.msg_output = results.message || "";
          //EXTRA DATA OUTPUT:
          endOptions.extra_output = {};
          endOptions.extra_output.db_fieldCount = results.fieldCount;
          endOptions.extra_output.db_affectedRows = results.affectedRows;
          endOptions.extra_output.db_changedRows = results.changedRows;
          endOptions.extra_output.db_insertId = results.insertId;
          endOptions.extra_output.db_warningCount = results.warningCount;
          endOptions.extra_output.db_message = results.message;
        }
        _this.end(endOptions);
      }
    }

    if (params.command) {
      executeQuery(params)
        .then((results) => {
          evaluateResults(results);
        })
        .catch(function (err) {
          endOptions.end = "error";
          endOptions.messageLog = `executeMysql executeQuery: ${err}`;
          endOptions.err_output = `executeMysql executeQuery: ${err}`;
          _this.end(endOptions);
        });
    } else {
      if (params.command_file) {
        loadSQLFile(params.command_file)
          .then((fileContent) => {
            params.command = fileContent;
            executeQuery(params)
              .then((results) => {
                evaluateResults(results);
              })
              .catch(function (err) {
                endOptions.end = "error";
                endOptions.messageLog = `executeMysql executeQuery from file: ${err}`;
                endOptions.err_output = `executeMysql executeQuery from file: ${err}`;
                _this.end(endOptions);
              });
          })
          .catch(function (err) {
            endOptions.end = "error";
            endOptions.messageLog = `executeMysql loadSQLFile: ${err}`;
            endOptions.err_output = `executeMysql loadSQLFile: ${err}`;
            _this.end(endOptions);
          });
      } else {
        endOptions.end = "error";
        endOptions.messageLog = "executeMysql dont have command or command_file";
        endOptions.err_output = "executeMysql dont have command or command_file";
        _this.end(endOptions);
      }
    }
  }
}

module.exports = mysqlExecutor;
