"use strict";

var mysql = require("mysql");
var csv = require("fast-csv");
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
          useArgsValues: true,
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

        if (params.xlsxFileExport){
          let workbook = new Excel.Workbook();
          workbook.creator = 'Runnerty';
          workbook.lastPrinted = new Date();

          let columns = [];
          for (var i = 0; i < Object.keys(results[0]).length; i++){
            columns.push({
              header: Object.keys(results[0])[i],
              key: Object.keys(results[0])[i],
              width: 30
            });
          }

          let sheet = workbook.addWorksheet("sheet");
          sheet.columns = columns;
          sheet.addRows(results);

          workbook.xlsx.writeFile(params.xlsxFileExport).then(function() {
              console.log("xls file is written.");
          });
        }
        
        csv.writeToString(results, {headers: true}, function (err, data) {
          if (err) {
            _this.logger.log("error", `Generating csv output for execute_db_results_csv: ${err}. Results: ${results}`);
          }
          endOptions.execute_db_countRows = results.length;
          endOptions.execute_db_results = JSON.stringify(results);
          endOptions.execute_db_results_object = results;
          endOptions.execute_db_results_csv = data;
          _this.end(endOptions);
        });

      } else {

        if (results instanceof Object) {
          endOptions.execute_db_results = "";
          endOptions.execute_db_results_object = [];
          endOptions.execute_db_results_csv = "";
          endOptions.execute_db_fieldCount = results.fieldCount;
          endOptions.execute_db_affectedRows = results.affectedRows;
          endOptions.execute_db_changedRows = results.changedRows;
          endOptions.execute_db_insertId = results.insertId;
          endOptions.execute_db_warningCount = results.warningCount;
          endOptions.execute_db_message = results.message;
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
          endOptions.execute_err_return = `executeMysql executeQuery: ${err}`;
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
                endOptions.execute_err_return = `executeMysql executeQuery from file: ${err}`;
                _this.end(endOptions);
              });
          })
          .catch(function (err) {
            endOptions.end = "error";
            endOptions.messageLog = `executeMysql loadSQLFile: ${err}`;
            endOptions.execute_err_return = `executeMysql loadSQLFile: ${err}`;
            _this.end(endOptions);
          });
      } else {
        endOptions.end = "error";
        endOptions.messageLog = "executeMysql dont have command or command_file";
        endOptions.execute_err_return = "executeMysql dont have command or command_file";
        _this.end(endOptions);
      }
    }
  }
}

module.exports = mysqlExecutor;
