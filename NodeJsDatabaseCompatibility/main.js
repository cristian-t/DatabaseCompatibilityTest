
var fs = require( "fs" );
var argv = require( "minimist" )( process.argv.slice( 2 ) );

var SimpleLog = require( "./SimpleLog.js" );
var JsonOperationReader = require( "./JsonOperationReader.js" );
var OperationRunner = require( "./OperationRunner.js" );

var inputDir = "./resources/";
var outputDir = "./results/";
var logDir = outputDir + "logs/";

var mainLog = new SimpleLog( logDir + "main.log" , true );
var resultFile = fs.createWriteStream( outputDir + "results_nodejs_ibmdb.json" );

var verbose = false;
if( argv.hasOwnProperty( "v" ) && argv.v === true ) verbose = true;

try
{
  var inputDirFiles = fs.readdirSync( inputDir );
  var testFiles = [],
      i;

  if( argv.hasOwnProperty( "t" ) )
  {
    testFiles.push( argv.t );
  }
  else
  {
    for( i = 0; i < inputDirFiles.length; i++ )
    {
      if( inputDirFiles[i].substr( -5 ) == ".json" )
        testFiles.push( inputDirFiles[i] );
    }
  }

  for( i = 0; i < testFiles.length; i++ )
  {
    var result = {
      language : "nodejs",
      client : "ibmdb",
      server : "Informix",
      test : testFiles[i]
    };

    var opReader = new JsonOperationReader( inputDir , testFiles[i] , mainLog );
    var testLog = new SimpleLog( logDir + opReader.getTestName() + ".log" , verbose );

    mainLog.log( "---- Running test: " + opReader.getTestName() );
    var opRunner = new OperationRunner( opReader , testLog );
    var runnerResult = opRunner.run();
    result.result = runnerResult.result;
    result.detail = runnerResult.detail;
    resultFile.write( JSON.stringify( result ) + "\n" );

    testLog.close();
  }

  mainLog.close();
  resultFile.end();
}
catch( e )
{
  mainLog.log( "Main Exception: " + e.message );
}
