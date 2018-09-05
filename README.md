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
The saved can be indicated in the file of the results obtained from a query in csv, xlsx and json format.
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

### Other considerations
If the result of your query is very large, you should consider using the "noReturnDataOutput" (boolean) property to prevent a large amount of data from entering memory and being interpreted by Runnerty, which could cause performance problems.

```json
{
  "id":"mysql_sample",
  "command": "SELECT * FROM LARGE_TABLE",
  "csvFileExport": "@GV(WORK_DIR)/LARGE_DATA.csv",
  "noReturnDataOutput": "true"
}
```


[Runnerty]: http://www.runnerty.io
