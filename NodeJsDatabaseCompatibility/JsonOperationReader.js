
var fs = require( "fs" );

var JsonOperationReader = function( inputDir , testFilePath , logFile ) {
  this.testName = testFilePath.substr( 0 , testFilePath.length - 5 );
  this.testFilePath = inputDir + testFilePath;
  this.logFile = logFile;
  this.operations = [];

  var data;
  try
  {
    data = fs.readFileSync( this.testFilePath , { encoding : "utf-8" } );
  }
  catch( e )
  {
    this.logFile.log( "Couldn't read test file " + this.testFilePath + ": " + e.message );
  }

  var lines = data.split( "\n" );
  for( var i = 0; i < lines.length; i++ )
  {
    // Ignore comments & empty lines
    if( lines[i][0] == "#" || !lines[i].trim() ) continue;
    try
    {
      var operation = JSON.parse( lines[i].trim() );
      operation.lineNumber = i + 1;
      this.operations.push( operation );
    }
    catch( e )
    {
      this.logFile.log( "Error parsing operation JSON: " + e.message );
      this.logFile.log( lines[i] );
    }
  }
};

JsonOperationReader.prototype.getTestName = function() {
  return this.testName;
};

JsonOperationReader.prototype.getOperations = function() {
  return this.operations;
};

module.exports = JsonOperationReader;
