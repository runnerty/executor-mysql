'use strict';

const mysql = require('mysql2');
const Excel = require('exceljs');
const csv = require('fast-csv');
const fs = require('fs');
const fsp = require('fs').promises;
const JsonStreamStringify = require('json-stream-stringify');
const path = require('path');

const Executor = require('@runnerty/module-core').Executor;

class mysqlExecutor extends Executor {
  constructor(process) {
    super(process);
    this.ended = false;
    this.endOptions = {
      end: 'end'
    };
  }

  async prepareQuery(values) {
    const options = {
      useExtraValue: values.args || false,
      useProcessValues: true,
      useGlobalValues: true,
      altValueReplace: 'null'
    };

    try {
      const query = await this.paramsReplace(values.command, options);
      return query;
    } catch (err) {
      throw err;
    }
  }

  async executeQuery(connection, query, params) {
    const queryOptions = {
      sql: query
    };

    if (params.localInFile) {
      if (fs.existsSync(params.localInFile)) {
        queryOptions.infileStreamFactory = () => {
          return fs.createReadStream(params.localInFile);
        };
      } else {
        throw new Error(`executeMysql - localInFile not exists: ${params.localInFile}`);
      }
    }

    try {
      const queryStream = connection.query(queryOptions);
      const author = 'Runnerty';
      const sheetName = 'Sheet';
      let isFirstRow = true;
      let firstRow = {};
      let resultSetHeader;
      let rowCounter = 0;
      const results = [];

      // XLSX FILE EXPORT
      // ****************
      if (params.xlsxFileExport) {
        await fsp.access(path.dirname(params.xlsxFileExport));
        const fileStreamWriter = fs.createWriteStream(params.xlsxFileExport);
        const options = {
          stream: fileStreamWriter,
          useStyles: true,
          useSharedStrings: true
        };
        const workbook = new Excel.stream.xlsx.WorkbookWriter(options);

        const sheet = workbook.addWorksheet(params.xlsxSheetName ? params.xlsxSheetName : sheetName);
        workbook.creator = params.xlsxAuthorName ? params.xlsxAuthorName : author;

        workbook.lastPrinted = new Date();

        queryStream.on('result', row => {
          if (isFirstRow) {
            firstRow = row;
            if (row.constructor.name === 'ResultSetHeader') {
              resultSetHeader = row;
            }
            sheet.columns = this.generateHeader(row);
            isFirstRow = false;
          }
          sheet.addRow(row).commit();
          rowCounter++;
        });
        queryStream.on('end', async _ => {
          await workbook.commit();
          this.prepareEndOptions(firstRow, rowCounter, resultSetHeader, results);
          this._end();
          connection.end();
        });
        queryStream.on('error', err => {
          connection.end();
          this._error(`executeMysql: ${err}`);
        });
      }
      // CSV FILE EXPORT
      // ***************
      else if (params.csvFileExport) {
        await fsp.access(path.dirname(params.csvFileExport));
        const fileStreamWriter = fs.createWriteStream(params.csvFileExport);

        const paramsCSV = params.csvOptions || {};
        if (!paramsCSV.hasOwnProperty('headers')) paramsCSV.headers = true;
        const csvStream = csv
          .format(paramsCSV)
          .on('error', err => {
            connection.end();
            this._error(`executeMysql - csvStream: ${err}`);
          })
          .on('end', () => {
            fileStreamWriter.end();
            this.prepareEndOptions(firstRow, rowCounter, resultSetHeader, results);
            this._end();
            connection.end();
          });

        // STREAMED
        queryStream
          .on('result', row => {
            if (isFirstRow) {
              firstRow = row;
              if (row.constructor.name === 'ResultSetHeader') {
                resultSetHeader = row;
              }
              isFirstRow = false;
            }
            rowCounter++;
          })
          .on('error', err => {
            connection.end();
            this._error(`executeMysql: ${err}`);
          })
          .stream()
          .pipe(csvStream)
          .pipe(fileStreamWriter);
      }
      // TEXT FILE EXPORT JSON
      // *********************
      else if (params.fileExport) {
        await fsp.access(path.dirname(params.fileExport));
        const fileStreamWriter = fs.createWriteStream(params.fileExport);

        fileStreamWriter
          .on('finish', () => {
            this._end();
          })
          .on('error', err => {
            this._error(`ERROR executeMysql - fileStreamWriter ${err}`);
          });

        // STREAMED
        new JsonStreamStringify(
          queryStream
            .on('result', row => {
              if (isFirstRow) {
                firstRow = row;
                if (row.constructor.name === 'ResultSetHeader') {
                  resultSetHeader = row;
                }
                isFirstRow = false;
              }
              rowCounter++;
            })
            .on('error', err => {
              connection.end();
              this._error(`ERROR executeMysql - queryStream ${err}`);
            })
            .stream()
        ).pipe(fileStreamWriter);
      }
      // NO FILE EXPORT - DATA_OUTPUT
      // ****************************
      else {
        queryStream.on('result', row => {
          if (isFirstRow) {
            firstRow = row;
            if (row.constructor.name === 'ResultSetHeader') {
              resultSetHeader = row;
            }
            isFirstRow = false;
          }
          rowCounter++;
          results.push(row);
        });
        queryStream.on('end', _ => {
          connection.end();
          this.prepareEndOptions(firstRow, rowCounter, resultSetHeader, results);
          this._end();
        });
        queryStream.on('error', err => {
          connection.end();
          this._error(`executeMysql: ${err}`);
        });
      }
    } catch (err) {
      connection.end();
      this._error(`executeMysql: ${err}`);
    }
  }

  prepareEndOptions(firstRow, rowCounter, resultSetHeader, results) {
    //STANDARD OUPUT:
    this.endOptions.data_output = results || '';

    //EXTRA DATA OUTPUT:
    this.endOptions.extra_output = {};
    this.endOptions.extra_output.db_countrows = rowCounter;
    if (resultSetHeader) {
      this.endOptions.extra_output.db_fieldCount = resultSetHeader.fieldCount;
      this.endOptions.extra_output.db_affectedRows = resultSetHeader.affectedRows;
      this.endOptions.extra_output.db_changedRows = resultSetHeader.changedRows;
      this.endOptions.extra_output.db_insertId = resultSetHeader.insertId;
      this.endOptions.extra_output.db_warningCount = resultSetHeader.warningCount;
      this.endOptions.extra_output.db_message = resultSetHeader.info;
      this.endOptions.msg_output = resultSetHeader.info || '';
    } else {
      this.endOptions.extra_output.db_firstRow = JSON.stringify(firstRow);
      if (firstRow instanceof Object) {
        const keys = Object.keys(firstRow);
        let keysLength = keys.length;
        while (keysLength--) {
          const key = keys[keysLength];
          this.endOptions.extra_output['db_firstRow_' + key] = firstRow[key];
        }
      }
    }
  }

  generateHeader(row) {
    const columns = [];
    for (let i = 0; i < Object.keys(row).length; i++) {
      columns.push({
        header: Object.keys(row)[i],
        key: Object.keys(row)[i],
        width: 30
      });
    }
    return columns;
  }

  async exec(params) {
    // MAIN:
    try {
      if (!params.command) {
        if (params.command_file) {
          // Load SQL file:
          try {
            await fsp.access(params.command_file, fs.constants.F_OK | fs.constants.W_OK);
            params.command = await fsp.readFile(params.command_file, 'utf8');
          } catch (err) {
            throw new Error(`Load SQLFile: ${err}`);
          }
        } else {
          this._error('executeMysql dont have command or command_file');
        }
      }
      const query = await this.prepareQuery(params);
      this.endOptions.command_executed = query;

      //SSL
      if (params.ssl) {
        try {
          if (params.ssl.ca) params.ssl.ca = fs.readFileSync(params.ssl.ca);
          if (params.ssl.cert) params.ssl.cert = fs.readFileSync(params.ssl.cert);
          if (params.ssl.key) params.ssl.key = fs.readFileSync(params.ssl.key);
        } catch (error) {
          this._error(`executeMysql reading ssl file/s: ${error}`);
        }
      }

      const connection = mysql.createPool({
        host: params.host,
        socketPath: params.socketPath,
        port: params.port,
        ssl: params.ssl,
        user: params.user,
        password: params.password,
        database: params.database,
        multipleStatements: params.multipleStatements || true,
        charset: params.charset,
        timezone: params.timezone,
        insecureAuth: params.insecureAuth,
        debug: params.debug,
        connectTimeout: params.connectTimeout || 60000,
        dateStrings: params.dateStrings || false
      });

      connection.on('error', err => {
        this._error(`executeMysql: ${err}`);
      });

      const result = await this.executeQuery(connection, query, params);
      return result;
    } catch (err) {
      this._error(`executeMysql: ${err}`);
    }
  }

  _error(errMsg) {
    this.endOptions.end = 'error';
    this.endOptions.messageLog = errMsg || this.endOptions.messageLog;
    this.endOptions.err_output = errMsg || this.endOptions.err_output;
    this.end(this.endOptions);
  }

  _end() {
    if (!this.ended) this.end(this.endOptions);
    this.ended = true;
  }
}

module.exports = mysqlExecutor;
