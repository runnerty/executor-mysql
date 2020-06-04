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
        const options = {
          filename: params.xlsxFileExport,
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
            if (row.hasOwnProperty('ResultSetHeader')) {
              resultSetHeader = row.ResultSetHeader;
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
          this._end(this.endOptions);
          connection.end();
        });
        queryStream.on('error', err => {
          this.endOptions.end = 'error';
          this.endOptions.messageLog = `executeMysql: ${err}`;
          this.endOptions.err_output = `executeMysql: ${err}`;
          this._end(this.endOptions);
          connection.end();
        });
      }
      // CSV FILE EXPORT
      // ***************
      else if (params.csvFileExport) {
        const fileStreamWriter = fs.createWriteStream(params.csvFileExport);
        const paramsCSV = params.csvOptions || {};
        if (!paramsCSV.hasOwnProperty('headers')) paramsCSV.headers = true;
        const csvStream = csv
          .format(paramsCSV)
          .on('error', err => {
            this.endOptions.end = 'error';
            this.endOptions.messageLog = `executeMysql: ${err}`;
            this.endOptions.err_output = `executeMysql: ${err}`;
            this._end(this.endOptions);
            connection.end();
          })
          .on('end', () => {
            fileStreamWriter.end();
            this.prepareEndOptions(firstRow, rowCounter, resultSetHeader, results);
            this._end(this.endOptions);
            connection.end();
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

          rowCounter++;
          csvStream.write(row);
        });
        queryStream.on('end', _ => {
          csvStream.end();
          connection.end();
        });
        queryStream.on('error', err => {
          this.endOptions.end = 'error';
          this.endOptions.messageLog = `executeMysql: ${err}`;
          this.endOptions.err_output = `executeMysql: ${err}`;
          this._end(this.endOptions);
          connection.end();
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

        queryStream.on('end', () => {
          if (rowCounter) fileStreamWriter.write('\n]');

          fileStreamWriter.end();
          this.prepareEndOptions(firstRow, rowCounter, resultSetHeader, results);
          this._end(this.endOptions);
          connection.end();
        });

        queryStream.on('error', err => {
          this.endOptions.end = 'error';
          this.endOptions.messageLog = `executeMysql: ${err}`;
          this.endOptions.err_output = `executeMysql: ${err}`;
          this._end(this.endOptions);
          connection.end();
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
          rowCounter++;
          results.push(row);
        });
        queryStream.on('end', _ => {
          this.prepareEndOptions(firstRow, rowCounter, resultSetHeader, results);
          this._end(this.endOptions);
          connection.end();
        });
        queryStream.on('error', err => {
          this.endOptions.end = 'error';
          this.endOptions.messageLog = `executeMysql: ${err}`;
          this.endOptions.err_output = `executeMysql: ${err}`;
          this._end(this.endOptions);
          connection.end();
        });
      }
    } catch (err) {
      this.endOptions.end = 'error';
      this.endOptions.messageLog = `executeMysql: ${err}`;
      this.endOptions.err_output = `executeMysql: ${err}`;
      this._end(this.endOptions);
      connection.end();
    }
  }

  prepareEndOptions(firstRow, rowCounter, resultSetHeader, results) {
    //STANDARD OUPUT:
    this.endOptions.data_output = results || '';

    //EXTRA DATA OUTPUT:
    this.endOptions.extra_output = {};
    this.endOptions.extra_output.db_countrows = rowCounter;
    if (resultSetHeader) {
      console.log(resultSetHeader);
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
          params.command = await loadSQLFile(params.command_file);
        } else {
          this.endOptions.end = 'error';
          this.endOptions.messageLog = 'executeMysql dont have command or command_file';
          this.endOptions.err_output = 'executeMysql dont have command or command_file';
          this._end(this.endOptions);
        }
      }
      const query = await this.prepareQuery(params);
      this.endOptions.command_executed = query;
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
        connectTimeout: params.connectTimeout || 60000
      });

      connection.on('error', err => {
        this.endOptions.end = 'error';
        this.endOptions.messageLog = `executeMysql: ${err}`;
        this.endOptions.err_output = `executeMysql: ${err}`;
        this._end(this.endOptions);
      });

      const result = await this.executeQuery(connection, query, params);
      return result;
    } catch (err) {
      this.endOptions.end = 'error';
      this.endOptions.messageLog = `executeMysql: ${err}`;
      this.endOptions.err_output = `executeMysql: ${err}`;
      this._end(this.endOptions);
    }
  }

  _end(endOptions) {
    if (!this.ended) this.end(endOptions);
    this.ended = true;
  }
}

module.exports = mysqlExecutor;
