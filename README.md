<p align="center">
  <a href="http://runnerty.io">
    <img height="257" src="https://runnerty.io/assets/header/logo-stroked.png">
  </a>
  <p align="center">Smart Processes Management</p>
</p>

[![NPM version][npm-image]][npm-url] [![Downloads][downloads-image]][npm-url] [![Dependency Status][david-badge]][david-badge-url]
<a href="#badge">
  <img alt="code style: prettier" src="https://img.shields.io/badge/code_style-prettier-ff69b4.svg">
</a>

# MySql executor for [Runnerty]:


### Configuration sample:
```json
{
  "id": "mysql_default",
  "type": "@runnerty-executor-mysql",
  "user": "mysqlusr",
  "password": "mysqlpass",
  "database": "MYDB",
  "host": "myhost.com",
  "port": "3306"
}
```

### Plan sample:
```json
{
  "id":"mysql_default",
  "command_file": "/etc/runnerty/sql/test.sql"
}
```

```json
{
  "id":"mysql_default",
  "command": "SELECT NOW()"
}
```

```json
{
  "id":"mysql_sample",
  "command": "SELECT * FROM USERS",
  "csvFileExport": "@GV(WORK_DIR)/users.csv"
}
```

### Generation of files:
The saved can be indicated in the file of the results obtained from a query in csv, xlsx and json format. These files will be generated with streams.
You only have to indicate the corresponding property in the parameters:
* `xlsxFileExport`: XLSX Formart file path
* `csvFileExport`: CSV Formart file path
* `fileExport`: JSON Formart file path

```json
{
  "id":"mysql_sample",
  "command": "SELECT * FROM USERS",
  "xlsxFileExport": "@GV(WORK_DIR)/users.xlsx"
}
```

### Loading files:
For file upload you must indicate the path of the file to be loaded in the `localInFile` parameter and in the `LOAD DATA LOCAL INFILE` statement you must indicate `mystream`. For example:
* `localInFile`: Plain file path

```json
{
  "id":"mysql_sample",
  "command": "LOAD DATA LOCAL INFILE 'mystream' INTO TABLE DBSAMPLE.TABLESAMPLE FIELDS TERMINATED BY ',' LINES TERMINATED BY '\n'",
  "localInFile": "/sample.csv"
}
```

### Output (Process values):
#### Standard
* `PROCESS_EXEC_MSG_OUTPUT`: MySQL output message.
* `PROCESS_EXEC_ERR_OUTPUT`: Error output message.
#### Query output
* `PROCESS_EXEC_DATA_OUTPUT`: MySQL query output data.
* `PROCESS_EXEC_DB_COUNTROWS`: MySQL query count rows.
* `PROCESS_EXEC_DB_FIRSTROW`: MySQL query first row data.
* `PROCESS_EXEC_DB_FIRSTROW_[FILED_NAME]`: MySQL first row field data.
#### Operation output
* `PROCESS_EXEC_DB_FIELDCOUNT`: MySQL field count.
* `PROCESS_EXEC_DB_AFFECTEDROWS`: MySQL affected rows count.
* `PROCESS_EXEC_DB_CHANGEDROWS`: MySQL changed rows count.
* `PROCESS_EXEC_DB_INSERTID`: MySQL insert ID.
* `PROCESS_EXEC_DB_WARNINGCOUNT`: MySQL warning count.
* `PROCESS_EXEC_DB_MESSAGE`: MySQL message.



[Runnerty]: http://www.runnerty.io
