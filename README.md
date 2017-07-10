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
