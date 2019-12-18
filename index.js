'use strict';

const mysql = require('mysql2');
const Excel = require('exceljs');
const csv = require('fast-csv');
const fs = require('fs');

const loadSQLFile = global.libUtils.loadSQLFile;
const Execution = global.ExecutionClass;

class mysqlExecutor extends Execution {
  constructor(process) {
    super(process);
  }

  exec(params) {
    let _this = this;
    let endOptions = {
      end: 'end'
    };

    function prepareQuery(values) {
      return new Promise(async (resolve, reject) => {
        const options = {
          useExtraValue: values.args || false,
          useProcessValues: true,
          useGlobalValues: true,
          altValueReplace: 'null'
        };

        try {
          const _query = await _this.paramsReplace(values.command, options);
          endOptions.command_executed = _query;

          const connection = mysql.createConnection({
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
            connectTimeout: values.connectTimeout || 60000
          });

          await executeQuery(connection, _query);
          resolve();
        } catch (error) {
          reject(error);
        }
      });
    }

    function executeQuery(connection, query) {
      return new Promise((resolve, reject) => {
        let queryOptions = {
          sql: query
        };

        if (params.localInFile) {
          if (fs.existsSync(params.localInFile)) {
            queryOptions.infileStreamFactory = function() {
              return fs.createReadStream(params.localInFile);
            };
          } else {
            reject(`executeMysql - localInFile not exists: ${params.localInFile}`);
          }
        }

        try {
          const queryStream = connection.query(queryOptions);
          let author = 'Runnerty';
          let sheetName = 'Sheet';
          let isFirstRow = true;
          let firstRow = {};
          let resultSetHeader;
          let rowCounter = 0;
          let results = [];

          // XLSX FILE EXPORT
          // ****************
          if (params.xlsxFileExport) {
            const options = {
              filename: params.xlsxFileExport,
              useStyles: true,
              useSharedStrings: true
            };
            const workbook = new Excel.stream.xlsx.WorkbookWriter(options);

            let sheet = workbook.addWorksheet(params.xlsxSheetName ? params.xlsxSheetName : sheetName);
            workbook.creator = params.xlsxAuthorName ? params.xlsxAuthorName : author;

            workbook.lastPrinted = new Date();

            queryStream.on('result', row => {
              if (isFirstRow) {
                firstRow = row;
                if (row.hasOwnProperty('ResultSetHeader')) {
                  resultSetHeader = row.ResultSetHeader;
                }
                sheet.columns = generateHeader(row);
                isFirstRow = false;
              }
              sheet.addRow(row).commit();
              rowCounter++;
            });
            queryStream.on('end', _ => {
              workbook.commit().then(() => {
                _this.end(prepareEndOptions(firstRow, rowCounter, resultSetHeader));
                connection.destroy();
                resolve();
              });
            });
            queryStream.on('error', err => {
              _this.logger.log('error', `Generating xlsx: ${err}.`);
              reject(err);
            });
          }
          // CSV FILE EXPORT
          // ***************
          else if (params.csvFileExport) {
            const fileStreamWriter = fs.createWriteStream(params.csvFileExport);
            const csvStream = csv
              .format(
                Object.assign(
                  {
                    headers: true
                  },
                  params.csvOptions || {}
                )
              )
              .on('error', error => _this.logger.log('error', `Generating CSV: ${error}.`))
              // .on("data", row => console.log(row))
              .on('end', rowCount => {
                fileStreamWriter.end();
                _this.end(prepareEndOptions(firstRow, rowCount, resultSetHeader));
                connection.destroy();
              });

            csvStream.pipe(fileStreamWriter);

            queryStream.on('result', row => {
              if (isFirstRow) {
                firstRow = row;
                if (row.hasOwnProperty('ResultSetHeader')) {
                  resultSetHeader = row.ResultSetHeader;
                }
                isFirstRow = false;
              }

              csvStream.write(row);
            });
            queryStream.on('end', _ => {
              csvStream.end();
              resolve();
            });
            queryStream.on('error', err => {
              _this.logger.log('error', `Generating CSV: ${err}.`);
              reject();
            });
          }
          // TEXT FILE EXPORT JSON
          // *********************
          else if (params.fileExport) {
            const fileStreamWriter = fs.createWriteStream(params.fileExport);

            queryStream.on('result', row => {
              if (isFirstRow) {
                firstRow = row;
                if (row.hasOwnProperty('ResultSetHeader')) {
                  resultSetHeader = row.ResultSetHeader;
                }
                isFirstRow = false;
                fileStreamWriter.write('[\n');
                fileStreamWriter.write(JSON.stringify(row));
              } else {
                fileStreamWriter.write(',\n' + JSON.stringify(row));
              }
              rowCounter++;
            });

            queryStream.on('end', _ => {
              fileStreamWriter.write('\n]');
              fileStreamWriter.end();
              _this.end(prepareEndOptions(firstRow, rowCounter, resultSetHeader));
              connection.destroy();
              resolve();
            });

            queryStream.on('error', err => {
              _this.logger.log('error', `Generating file: ${err}.`);
              reject();
            });
          }
          // NO FILE EXPORT - DATA_OUTPUT
          // ****************************
          else {
            queryStream.on('result', row => {
              if (isFirstRow) {
                firstRow = row;
                if (row.hasOwnProperty('ResultSetHeader')) {
                  resultSetHeader = row.ResultSetHeader;
                }
                isFirstRow = false;
              }
              results.push(row);
            });
            queryStream.on('end', _ => {
              _this.end(prepareEndOptions(firstRow, rowCounter, resultSetHeader, results));
              connection.destroy();
              resolve();
            });
            queryStream.on('error', err => {
              _this.logger.log('error', `MySQL Query: ${err}.`);
              reject();
            });
          }
        } catch (error) {
          reject(error);
        }
      });
    }

    function prepareEndOptions(firstRow, rowCounter, resultSetHeader, results) {
      //STANDARD OUPUT:
      endOptions.data_output = results || '';

      //EXTRA DATA OUTPUT:
      endOptions.extra_output = {};
      endOptions.extra_output.db_fieldCount = rowCounter;
      if (resultSetHeader) {
        endOptions.extra_output.db_fieldCount = resultSetHeader.fieldCount || rowCounter;
        endOptions.extra_output.db_affectedRows = resultSetHeader.affectedRows;
        endOptions.extra_output.db_changedRows = resultSetHeader.changedRows;
        endOptions.extra_output.db_insertId = resultSetHeader.insertId;
        endOptions.extra_output.db_warningCount = resultSetHeader.warningCount;
        endOptions.extra_output.db_message = resultSetHeader.message;
        endOptions.msg_output = resultSetHeader.message || '';
      } else {
        endOptions.extra_output.db_firstRow = JSON.stringify(firstRow);
        if (firstRow instanceof Object) {
          let keys = Object.keys(firstRow);
          let keysLength = keys.length;
          while (keysLength--) {
            let key = keys[keysLength];
            endOptions.extra_output['db_firstRow_' + key] = firstRow[key];
          }
        }
      }

      return endOptions;
    }

    function generateHeader(row) {
      let columns = [];
      for (let i = 0; i < Object.keys(row).length; i++) {
        columns.push({
          header: Object.keys(row)[i],
          key: Object.keys(row)[i],
          width: 30
        });
      }
      return columns;
    }

    // MAIN:
    if (params.command) {
      prepareQuery(params).catch(err => {
        endOptions.end = 'error';
        endOptions.messageLog = `executeMysql prepareQuery: ${err}`;
        endOptions.err_output = `executeMysql prepareQuery: ${err}`;
        _this.end(endOptions);
      });
    } else {
      if (params.command_file) {
        loadSQLFile(params.command_file)
          .then(fileContent => {
            params.command = fileContent;
            prepareQuery(params).catch(err => {
              endOptions.end = 'error';
              endOptions.messageLog = `executeMysql prepareQuery from file: ${err}`;
              endOptions.err_output = `executeMysql prepareQuery from file: ${err}`;
              _this.end(endOptions);
            });
          })
          .catch(err => {
            endOptions.end = 'error';
            endOptions.messageLog = `executeMysql loadSQLFile: ${err}`;
            endOptions.err_output = `executeMysql loadSQLFile: ${err}`;
            _this.end(endOptions);
          });
      } else {
        endOptions.end = 'error';
        endOptions.messageLog = 'executeMysql dont have command or command_file';
        endOptions.err_output = 'executeMysql dont have command or command_file';
        _this.end(endOptions);
      }
    }
  }
}

module.exports = mysqlExecutor;
