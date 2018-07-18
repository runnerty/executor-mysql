"use strict";

const mysql = require("mysql");
const Excel = require("exceljs");
const fs = require("fs");

const loadSQLFile = global.libUtils.loadSQLFile;
const Execution = global.ExecutionClass;

class mysqlExecutor extends Execution {
  constructor(process) {
    super(process);
  }

  exec(params) {
    let _this = this;
    let endOptions = {end: "end"};

    function executeQuery(values) {
      
      return new Promise(async (resolve, reject) =>{
        const options = {
          useExtraValue: values.args || false,
          useProcessValues: true,
          useGlobalValues: true,
          altValueReplace: "null"
        };

        let _query = await _this.paramsReplace(values.command, options);
        endOptions.command_executed = _query;

        let pool = mysql.createPool({
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
          connectTimeout: values.connectTimeout || 60000,
          acquireTimeout: values.acquireTimeout || 60000
        });

        pool.getConnection((err, connection) => {
          if (err) {
            reject(`Error connecting Mysql: ${err}`);
          } else {
            connection.query(_query, null, (err, results) => {
              if (err) {
                reject(`executeMysql query ${_query}: ${err}`);
              } else {
                resolve(results);
              }
              connection.destroy();
              pool.end((err)=>{
                if(err){
                  _this.logger.debug("Ending pool error:",err);
                }
              });
            });
          }
        });
      });
    }

    function evaluateResults(results) {
      if (results instanceof Array) {

        if (params.xlsxFileExport || params.csvFileExport || params.fileExport){
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
            for (let i = 0; i < Object.keys(results[0]).length; i++){
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
            workbook.xlsx.writeFile(params.xlsxFileExport).then((err, data) =>{
              if (err){
                _this.logger.log("error", `Generating xlsx: ${err}. Results: ${results}`);
              }
            });
          }

          if (params.csvFileExport){
            workbook.csv.writeFile(params.csvFileExport, params.csvOptions).then((err, data) =>{
              if (err){
                _this.logger.log("error", `Generating csv: ${err}. Results: ${results}`);
              }
            });
          }

          if (params.fileExport){
            fs.writeFile(params.fileExport, JSON.stringify(results), "utf8", (err) => {
              if (err) {
                _this.logger.log("error", `Generating file: ${err}. Results: ${results}`);
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
        .catch((err) =>{
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
              .catch((err) => {
                endOptions.end = "error";
                endOptions.messageLog = `executeMysql executeQuery from file: ${err}`;
                endOptions.err_output = `executeMysql executeQuery from file: ${err}`;
                _this.end(endOptions);
              });
          })
          .catch((err) => {
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
