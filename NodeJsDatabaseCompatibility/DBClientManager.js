
var DBSession = require( "./DBSession.js" );

var DBCredentials = function( id )
{
  this.id = id;
  this.host = "9.25.157.41";
  this.port = 9091;
  this.database = "testdb4";
  this.username = "informix";
  this.password = "informix";
};

DBCredentials.prototype.getConnectionString = function()
{
  return  "DATABASE=" + this.database +
         ";HOSTNAME=" + this.host +
         ";PORT=" + this.port +
         ";UID=" + this.username +
         ";PWD=" + this.password +
         ";PROTOCOL=TCPIP;DB_LOCALE=en_US.utf8;CLIENT_LOCALE=en_US.utf8;Authentication=server";
};

var credentials = {},
    sessions = {};

var lastCredentials = null,
    lastSession = null;

function createCredentials( id )
{
  lastCredentials = new DBCredentials( id );
  credentials[ id ] = lastCredentials;
  return lastCredentials;
}

function closeCredentials( id )
{
  delete credentials[ id ];
}

function getCredentials( id )
{
  if( !id ) return lastCredentials;
  return credentials.hasOwnProperty( id ) ? credentials[ id ] : null;
}

function createSession( id , credential )
{
  lastSession = new DBSession( id , credential );
  sessions[ id ] = lastSession;
  return lastSession;
}

function closeSession( id )
{
  if( !sessions.hasOwnProperty( id ) ) return;

  sessions[ id ].close();
  delete sessions[ id ];
}

function getSession( id )
{
  if( !id ) return lastSession;
  return sessions.hasOwnProperty( id ) ? sessions[ id ] : null;
}

function cleanUp()
{
  var id;
  for( id in sessions )
  {
    sessions[ id ].cleanUp();
  }

  credentials = {};
  sessions = {};

  lastCredentials = null;
  lastSession = null;
}

module.exports = {
  createCredentials : createCredentials,
  closeCredentials : closeCredentials,
  getCredentials : getCredentials,
  createSession : createSession,
  closeSession : closeSession,
  getSession : getSession,
  cleanUp : cleanUp
};
