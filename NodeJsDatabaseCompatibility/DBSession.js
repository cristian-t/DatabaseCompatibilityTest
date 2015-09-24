
var ibmdb = require( "ibm_db" );

var DBSession = function( id , credential )
{
  if( !credential ) throw new Error( "New session requires credentials" );

  this.id = id;
  this.credential = credential;
  this.connection = null;

  this.preparedStatements = {};
  this.lastPreparedStatement = null;
};

DBSession.prototype.getConnection = function()
{
  if( !this.connection )
  {
    var connectionString = this.credential.getConnectionString();
    this.connection = ibmdb.openSync( connectionString );
  }

  return this.connection;
};

DBSession.prototype.close = function()
{
  if( this.connection ) this.connection.closeSync();
};

DBSession.prototype.putPreparedStatement = function( id , statement )
{
  this.lastPreparedStatement = statement;
  this.preparedStatements[ id ] = this.lastPreparedStatement;
};

DBSession.prototype.getPreparedStatement = function( id )
{
  if( !id ) return this.lastPreparedStatement;
  return this.preparedStatements.hasOwnProperty( id ) ? this.preparedStatements[ id ] : null;
};

DBSession.prototype.closePreparedStatement = function( id )
{
  delete this.preparedStatements[ id ];
};

DBSession.prototype.cleanUp = function()
{
  if( this.connection )
  {
    for( var id in this.preparedStatements )
    {
      var statement = this.preparedStatements[id];
      try
      {
        if( statement.result ) statement.result.closeSync();
        if( statement.stmt ) statement.stmt.closeSync();
      }
      catch( e ) {}
    }

    try
    {
      this.connection.closeSync();
    }
    catch( e ) {}
  }
};

module.exports = DBSession;
