var       fs = require( 'fs' )
  ,     path = require( 'path' )
  ,    child = require( 'child_process' )
  ,    spawn = child.spawn
  ,  program = require( 'commander' )
  ,  ProgressBar = require('progress')

  ,     exts = '3g2,3gp,aepx,ale,asf,asx,avi,avp,avs,bdm,bik,bsf,camproj,cpi,divx,dmsm,dream,dvdmedia,dvr-ms,dzm,dzp,edl,f4v,fbr,fcproject,flv,hdmov,imovieproj,m2p,m2ts,m4v,mkv,mod,moi,mov,mp4,mpeg,mpg,mts,mxf,ogv,pds,prproj,psh,r3d,rcproject,rm,rmvb,scm,smil,sqz,srt,stx,swf,swi,tix,trp,ts,veg,vf,vob,vro,webm,wlmp,wmv,wtv,xvid,yuv'
  , toEncode = []
  ,    chrOk = String.fromCharCode( 10003 )
  ,  chrFail = String.fromCharCode( 10007 )
  , folder, extRx, activeEncoder;

/**
 * Program Options
 **/
program
	.version( '0.1' )
	.usage  ( '[options] folder' )

	.option ( '-R, --recursive'                , 'Recursively scan directory' )
	.option ( '-d, --delete'                   , 'Delete the original video on successful encoding' )
	.option ( '-f, --force'                    , 'Force over-write of existing files' )
	.option ( '-k, --keep'                     , 'Keep partially encoded files from encoding failures' )
	.option ( '-w, --watch'                    , 'Watch the folder indefinitely for new video files' )
	.option ( '-Z, --preset       <name>'      , 'Handbrake video preset (default: AppleTV 2)', 'AppleTV 2' )
	.option ( '-H, --handbrake    <path>'      , 'Path to handbrake-cli (default: /usr/local/bin/HandBrakeCLI)')
	.option ( '-c, --cpu          <count>'     , 'Set CPU count (default: autodetected)', parseInt )
	.option ( '-x, --extensions   <extensions>', 'Comma-separated list of file extensions to process (default: [long list])')
	.option ( '-X, --outputext    <ext>'       , 'Extension for generated files (default: m4v)' )
	.option ( '-O, --outputfolder <folder>'    , 'Folder in which to place completed videos (default: same-as-original)' )

	.parse  ( process.argv );


/**
 * Process arguments and start folder scan
 **/
process.nextTick( function(){
	folder = resolve( folder );

	program.outputext || ( program.outputext = 'm4v'                         );
	program.preset    || ( program.preset    = 'AppleTV 2'                   );
	program.handbrake || ( program.handbrake = '/usr/local/bin/HandBrakeCLI' );

	if( !path.existsSync( program.handbrake ) ){ die( 'HandBrakeCLI not found' ); }

	extRx = new RegExp( '\\.(' + 
		( program.extensions || exts )
			.replace( /,/g, '|' )
		 + ')$' );

	if( program.outputfolder ) {
		program.outputfolder = resolve( program.outputfolder );
	}

	scan( folder, program.recursive );
	encode();
});

folder = program.args[0];

/**
 * Display help when invalid arguments are passed in
 **/
if( !folder || ( program.args.length > 1 ) ) {
	console.error( program.helpInformation() );
	die();
}


/**
 * Watch for process exit
 **/
process.on( 'exit', function(){
	activeEncoder && activeEncoder.abandon();
});


/**
 * Kill app with an optional death message
 **/
function die( msg ) {
	console.error( msg );
	process.exit();
}	

/**
 * Resolve a folder or die
 **/
function resolve( folder ) {
	if( folder.indexOf( '/' ) ){
		folder = path.join( process.cwd(), folder );	
	}

	if( path.existsSync( folder ) ) {
		return folder;
	}else{
		die( 'Folder does not exist: ' + folder );
	}

	return folder;
}


/**
 * Scan folder seeking out any video files
 **/
function scan( folder, recursive ) {
	var files = fs.readdirSync( folder );

	for( var i=0, l=files.length; i<l; i++ ){
		var fPath = path.join( folder, files[i] );

		if( fs.statSync( fPath ).isDirectory() ){
			if( recursive ){
				scan( fPath, true );
			}
		} else {
			if( extRx.test( fPath ) ){
				addFile( fPath );
			}
		}
	}

	if( program.watch ){
		setTimeout( function(){
			scan( folder, recursive );
			encode();
		}, 3E5 ); // re-scan every 5 minutes
	}
}


/**
 * Add video file to queue
 **/
function addFile( path ) {
	toEncode.push( path );
	console.log( 'Found File: ' + path );
}


/**
 * Encode next file in queue
 **/
function encode() {
	// wait your turn!
	if( activeEncoder && activeEncoder.running ) { 
	  return ; 
	}

	if( !toEncode.length ) {
		return;
	}

	activeEncoder = new Encoder( toEncode.shift() );
}


/**
 * File encoder
 **/
function Encoder( fPath ){
	this.startTime = Date.now();
	this.inPath    = fPath;
	this.inFile    = fPath.split( /(\/|\\)/ ).pop();
	this.inFolder  = fPath.replace( /[\/\\][^\/\\]+$/, '' );
	this.outPath   = path.join( program.outputfolder || this.inFolder, this.inFile.replace( /\.[^\.]+$/, '' ) + '.' + program.outputext );

	this.pbTotal = 0;
	console.log( '  Encoding  ' + this.inFile + ' ' );
  this.bar = new ProgressBar('  Encoding [:bar] :percent :etas :current', {
      complete: '='
    , incomplete: ' '
    , width: 20
    , total: 10000
  });

	if( this.inPath === this.outPath ) {
		return this.abandon( 'Source & Destination are the same' );
	}
	if( !program.force && path.existsSync( this.outPath ) ){
		return this.abandon( 'Destination file already exists' );
	}

	var args = [];

	if( program.cpu ){ args.push( '-c', program.cpu ); }
	args.push( '-Z', program.preset );
	args.push( '-i', this.inPath  );
	args.push( '-o', this.outPath );

	this.started = true;
	this.encoder = spawn( program.handbrake, args );
	this.encoder.stdout.on( 'data', this.onChildData.bind( this ) );
	this.encoder       .on( 'exit', this.onChildExit.bind( this ) );
}

Encoder.prototype = {
	onChildData : function( data ){
    //console.log(data.toString()); //Encoding: task 1 of 1, 0.64 %
		var pDone = parseFloat( /([\.0-9]+) %/.exec( data.toString() ) );
		//console.log(pDone); // 0.64
    pDone = parseInt( pDone * 100 ); 
    var inc = (pDone - this.pbTotal);
    this.pbTotal += inc;
    this.bar.tick(inc);
    if (this.bar.complete) {
      console.log(); // clear the progress bar ??
    }
	}, 
	onChildExit : function( code ) {
		if( code === 0 ) {
			// Success!
      console.log(); // clear the progress bar ??
			this.removeInfile().success();
			process.nextTick( encode );

		} else {
			this.abandon( 'Unknown error encoding ' );
			// Dunno
		}
		this.exit();
	}, 
	exit: function() {
		console.log( '' );
		return this;
	}, 
	fail: function( msg ) {
    console.log( chrFail + ' ' + msg );
		return this;
	}, 
	success: function() {
		console.log( chrOk + ' Success!' );
		return this;
	}, 
	abandon: function( msg ) {
		if( this.abandoned ) { 
		  return this; 
		}
    console.log(); // clear the progress bar ??
		this.encoder && this.encoder.kill();
		this.removeOutfile();

		// start next encoder -- nextTick in case abandon is called due to process.exit
		process.nextTick( encode );
		this.abandoned = true;

		return this.fail( msg ).exit();
	}, 
	removeOutfile: function() {
		!program.keep && this.started && path.existsSync( this.outPath ) && fs.unlinkSync( this.outPath );
		return this;
	}, 
	removeInfile: function() {
		program.delete && path.existsSync( this.inPath ) && fs.unlinkSync( this.inPath );
		return this;
	}
};
