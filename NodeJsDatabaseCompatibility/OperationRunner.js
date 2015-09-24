
var deepEqual = require( "deep-equal" );

var SimpleLog = require( "./SimpleLog.js" );
var ClientManager = require( "./DBClientManager.js" );

function numberToBinaryString( v )
{
  var float = Float64Array( 1 );
  var bytes = Uint8Array( float.buffer );

  float[0] = v;

  var binary = "";
  var pos = 0;
  for( var j = 7; j >= 0; j-- )
  {
    for( var i = 7; i >= 0; i-- )
    {
      binary += ( bytes[j] & ( 1 << i ) ) ? "1" : "0";
      pos++;
    }
  }

  return binary.substring( 0 , 32 );
}

function testSmallFloat( f1 , f2 )
{
  var bs1 = numberToBinaryString( f1 );
  var bs2 = numberToBinaryString( f2 );
  return bs1 === bs2;
}

var Resources = {};

Resources.credentials = function( op )
{
  if( op.action == "create" )
  {
    this.log( "Creating credential id: " + op.credentialId );
    ClientManager.createCredentials( op.credentialId );
  }
  else if( op.action == "close" )
  {
    this.log( "Closing credential id: " + op.credentialId );
    ClientManager.closeCredentials( op.credentialId );
  }
  else this.log( "Unknown credentials action: " + op.action );
};

Resources.session = function( op )
{
  var session, conn;

  if( op.action == "create" )
  {
    this.log( "Creating session id: " + op.sessionId );
    ClientManager.createSession( op.sessionId , ClientManager.getCredentials( op.credentialId ) );
  }
  else if( op.action == "close" )
  {
    this.log( "Closing session id: " + op.sessionId );
    ClientManager.closeSession( op.sessionId );
  }
  else if( op.action == "startTransaction" )
  {
    session = ClientManager.getSession( op.sessionId );
    conn = session.getConnection();
    this.log( "Starting transaction on session: " + session.id );

    try
    {
      conn.beginTransactionSync();
    }
    catch( e )
    {
      throw new Error( "Unable to start transaction: " + e.message );
    }
  }
  else if( op.action == "commitTransaction" )
  {
    session = ClientManager.getSession( op.sessionId );
    conn = session.getConnection();
    this.log( "Commiting transaction on session: " + session.id );

    try
    {
      conn.commitTransactionSync();
    }
    catch( e )
    {
      throw new Error( "Unable to commit transaction: " + e.message );
    }
  }
  else if( op.action == "rollbackTransaction" )
  {
    session = ClientManager.getSession( op.sessionId );
    conn = session.getConnection();
    this.log( "Rolling back transaction on session: " + session.id );

    try
    {
      conn.rollbackTransactionSync();
    }
    catch( e )
    {
      throw new Error( "Unable to rollback transaction: " + e.message );
    }
  }
  else this.log( "Unknown session action: " + op.action );
};

Resources.statement = function( op )
{
  if( op.action == "execute" )
  {
    var conn = ClientManager.getSession( op.sessionId ).getConnection();
    this.log( "Executing statement: " + op.sql );
    var result = conn.querySync( op.sql );
  }
  else if( op.action == "close" )
  {
    // N/A ?
  }
  else this.log( "Unkown statement action: " + op.action );
};

Resources.preparedStatement = function( op )
{
  var session, conn, statement, data, bindings;

  if( op.action == "create" )
  {
    this.log( "Creating prep'd statement: " + op.statementId );
    session = ClientManager.getSession( op.sessionId );
    conn = session.getConnection();
    statement = {
      stmt : null,
      result : null
    };

    try
    {
      statement.stmt = conn.prepareSync( op.sql );
    }
    catch( e )
    {
      throw new Error( "Unable to prepare statement: " + e.message );
    }

    session.putPreparedStatement( op.statementId , statement );
  }
  else if( op.action == "close" )
  {
    this.log( "Closing prep'd statement: " + op.statementId );

    try
    {
      session = ClientManager.getSession( op.sessionId );
      statement = session.getPreparedStatement( op.statementId );

      statement.stmt.closeSync();
      session.closePreparedStatement( op.statementId );
    }
    catch( e )
    {
      throw new Error( "Unable to close prep'd statement: " + e.message );
    }

    ClientManager.getSession( op.sessionId ).closePreparedStatement( op.statementId );
  }
  else if( op.action == "execute" )
  {
    session = ClientManager.getSession( op.sessionId );
    conn = session.getConnection();
    statement = session.getPreparedStatement( op.statementId );

    if( op.bindings && op.bindings.length > 0 )
    {
      if( typeof op.bindings[0] == "object" && op.bindings[0].hasOwnProperty( "value" ) )
      {
        bindings = op.bindings.map( function( v ) { return v.value; } );
      }
      else
      {
        bindings = op.bindings;
      }
      statement.stmt.bindSync( bindings );
    }

    if( statement.result ) statement.result.closeSync();

    try
    {
      statement.result = statement.stmt.executeSync();
    }
    catch( e )
    {
      throw new Error( "Unable to execute prepared statement: " + e.message );
    }

    data = this.fetchRows( statement , op.nfetch );

    if( op.expectedResults )
    {
      if( !this.testResults( data , op.expectedResults ) )
      {
        throw new Error( "Unexpected result." +
                         "\nExpected: " + JSON.stringify( op.expectedResults ) +
                         "\nReceived: " + JSON.stringify( data ) );
      }
    }
  }
  else if( op.action == "fetch" )
  {
    session = ClientManager.getSession( op.sessionId );
    conn = session.getConnection();
    statement = session.getPreparedStatement( op.statementId );

    if( !statement.result )
    {
      throw new Error( "Attempted to fetch results from a prep'd statement that was not executed." );
    }

    data = this.fetchRows( statement , op.nfetch );

    if( op.expectedResults )
    {
      if( !this.testResults( data , op.expectedResults ) )
      {
        throw new Error( "Unexpected result." +
                         "\nExpected: " + JSON.stringify( op.expectedResults ) +
                         "\nReceived: " + JSON.stringify( data ) );
      }
    }
  }
  else this.log( "Unknown prep'd statement action: " + op.action );
};

var OperationRunner = function( opReader , logFile )
{
  this.opReader = opReader;
  this.logFile = logFile;
  this.lineNumber = 0;
};

OperationRunner.prototype.log = function( msg )
{
  this.logFile.log( this.lineNumber + ": " + msg );
};

OperationRunner.prototype.error = function( msg )
{
  this.log( "[ERROR] " + msg );
};

OperationRunner.prototype.run = function( callback )
{
  var ops = this.opReader.getOperations();
  for( var i = 0; i < ops.length; i++ )
  {
    var op = ops[i];
    this.lineNumber = op.lineNumber;

    if( !Resources.hasOwnProperty( op.resource ) )
    {
      this.log( "Unknown resource: " + op.resource );
      continue;
    }

    try
    {
      Resources[ op.resource ].call( this , op );
    }
    catch( e )
    {
      this.error( e.message );

      this.log( "Cleaning up..." );
      ClientManager.cleanUp();

      return {
        result : false,
        detail : e.message
      };
    }
  }

  return { result : true };
};

OperationRunner.prototype.fetchRows = function( statement , nfetch ) {
  var data = null;
  if( !nfetch )
  {
    try
    {
      data = statement.result.fetchAllSync();
    }
    catch( e )
    {
      throw new Error( "Unable to fetch all rows: " + e.message );
    }
  }
  else
  {
    data = [];
    for( var i = 0; i < nfetch; i++ )
    {
      try
      {
        data.push( statement.result.fetchSync() );
      }
      catch( e )
      {
        throw new Error( "Unable to fetch row " + ( i + 1 ) + ": " + e.message );
      }
    }
  }

  return data;
};

OperationRunner.prototype.testResults = function( actual , expected ) {
  if( actual.length !== expected.length ) return false;
  for( var i = 0; i < expected.length; i++ )
  {
    if( !this.testObjects( actual[i] , expected[i] ) ) return false;
  }

  return true;
};

OperationRunner.prototype.testObjects = function( actual , expected ) {
  var key;
  for( key in actual )
  {
    if( !expected.hasOwnProperty( key ) )
    {
      this.logFile.log( "Extra key: " + key );
      return false;
    }
  }

  for( key in expected )
  {
    if( !actual.hasOwnProperty( key ) )
    {
      this.logFile.log( "Missing key: " + key );
      return false;
    }
    if( typeof expected[ key ] !== typeof actual[ key ] )
    {
      this.logFile.log( "Type expected: " + ( typeof expected[ key ] ) );
      this.logFile.log( "Type received: " + ( typeof actual[ key ] ) );
      return false;
    }

    if( this.opReader.getTestName().indexOf( "SMALLFLOAT" ) != -1 && typeof expected[ key ] == "number")
    {
      if( !testSmallFloat( expected[ key ] , actual[ key ] ) )
      {
        this.logFile.log( "Expected: " + expected[ key ] );
        this.logFile.log( "Received: " + actual[ key ] );
        this.logFile.log( "Expected: " + numberToBinaryString( expected[ key ] ) );
        this.logFile.log( "Received: " + numberToBinaryString( actual[ key ] ) );
        return false;
      }
    }
    else
    {
      if( expected[ key ] !== actual[ key ] )
      {
        var eString, aString;
        if( typeof expected[ key ] == "object" )
        {
          eString = JSON.stringify( expected[ key ] );
          aString = JSON.stringify( actual[ key ] );
        }
        else
        {
          eString = expected[ key ];
          aString = actual[ key ];
        }

        this.logFile.log( "Expected: " + eString );
        this.logFile.log( "Received: " + aString );
        return false;
      }
    }
  }

  return true;
};

module.exports = OperationRunner;
