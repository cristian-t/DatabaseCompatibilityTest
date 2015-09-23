
var fs = require( "fs" );

var SimpleLog = function( path , logToConsole ) {
  this.path = path;
  this.logToConsole = false;
  if( logToConsole === true ) this.logToConsole = true;
  this.stream = fs.createWriteStream( path , { encoding : "utf-8" } );
};

SimpleLog.prototype.log = function( message ) {
  this.stream.write( message + "\n" );
  if( this.logToConsole ) console.log( message );
};

SimpleLog.prototype.close = function() {
  this.stream.end();
};

module.exports = SimpleLog;
