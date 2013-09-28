var http = require('http'),
    https = require('https'),
    fs = require('fs') ;

var Server = {

  saveDir: process.env[(process.platform === 'win32') ? 'USERPROFILE' : 'HOME'] + '/Documents/document-overlayer-cache/',

  url: '',
  documentName: '',
  docSaveDir: '',

  baseImageURL: '',
  numberOfPages: '',

  pageNumber: null,
  pageSaveLocation: '',

  // console.log('checking if ', saveDir, 'exists...') ;
  // fs.mkdir(saveDir, function(){
  //   console.log('created save dir', arguments) ;
  //   $('.saveLocation').html('Saving files in: ' + saveDir) ;
  // }) ;

  init: function(){

    var given = this ;

    http.createServer(function (req, res) {

      var urlParts = req.url.split('/') ;
      console.log('url parts', urlParts) ;

      //first parameter = url (of google doc viewer)
      if(urlParts[1].indexOf('http') > -1) {

        given.url = decodeURIComponent(urlParts[1]) ;
        given.loadDocument(function(){

          if(urlParts[2] && parseInt(urlParts[2], 10) > 0) {

            console.log('got an page number!') ;

            given.pageNumber = parseInt(urlParts[2], 10) ;

            given.downloadPage(given.pageNumber, function(){

              console.log('got page') ;

              //output png here
              var img = fs.readFileSync(given.pageSaveLocation);
              res.writeHead(200, {'Content-Type': 'image/png' });
              res.end(img, 'binary');

            }) ;

          }
          else {
            //cache everything!
            given.downloadNextPage(given.numberOfPages) ;
          }

        }) ;

      }
      else {
  
        //for the sake of pinging
        res.writeHead(200, {'Content-Type': 'text/plain'});
        res.end('success');
        
      }


    }).listen(1337, '127.0.0.1');

    $('.status').html('Ready for caching') ;

  }, //init

  loadDocument: function(cb){

    var given = this,
        stuffWeDontCareAbout = 'https://docs.google.com/viewer?url=https://dl.dropboxusercontent.com/s/' ;
    given.documentName = decodeURIComponent(decodeURIComponent(given.url).replace(stuffWeDontCareAbout, '').split('/')[1].split('?')[0]),

    given.docSaveDir = given.saveDir + given.documentName.replace(' ', '-').replace('.', '-') ;

    //check if we have a folder
    fs.exists(given.docSaveDir, function(exists) {

      console.log('doc folder exists', exists) ;

      if(exists) {

        //read the info!
        fs.readFile(given.docSaveDir + '/_info.txt', function(err, f){

          var params = JSON.parse(f.toString()) ;

          console.log('params', params) ;

          given.baseImageURL = params.baseImageURL ;
          given.numberOfPages = params.numberOfPages ;

          $('.log').prepend('<li>Found ' + given.documentName + ' in cache') ;

          //fire callback!
          cb() ;

        });

      }
      else {

        $('.log').prepend('<li>Waiting for Google\'s magic...</li>') ;

        $('iframe').remove() ; //double check
        var $iframe = $('<iframe />').attr('src', given.url) ;
        $('body').append($iframe) ;

        $('iframe').load(function(){

          fs.mkdir(given.docSaveDir, function(){

            console.log('iframe loaded') ;

            given.baseImageURL = 'https://docs.google.com/viewer' + $('iframe').contents().find('.page-image:nth-of-type(2)').attr('src') ;
            given.numberOfPages = parseInt($('iframe').contents().find('#controlbarPageNumber').html().split(' / ')[1], 10) ;

            fs.writeFileSync(given.docSaveDir + '/_info.txt', JSON.stringify(given), 'UTF-8', {'flags': 'w+'});

            $('.log').prepend('<li>Downloading ' + given.numberOfPages + ' pages for ' + given.documentName + '</li>') ;

            console.log('doc folder is ready') ;

            cb(); //ready for

          }) ;

        }) ;

      }
    
    }) ;

  }, //load document

  downloadNextPage: function(i){

    var given = this ;
    given.downloadPage(i, function(){
  
      $('.log li:first').html('<li>Downloading ' + i + '/' + given.numberOfPages + ' pages for ' + given.documentName + '</li>') ;

      if(i > 1) {
        given.downloadNextPage(i - 1) ;
      }
  
      if(i === 1) {
        $('.log').prepend('<li>Finished downloading ' + given.documentName + '</li>') ;
        $('iframe').remove() ;
      }

    }) ;

  },

  downloadPage: function(pageNumber, cb){

    console.log('attemtping to save page ', pageNumber) ;

    var given = this,
        pageImageURL = given.baseImageURL.replace('pagenumber=1', 'pagenumber=' + pageNumber) ;
    
    given.pageSaveLocation = given.docSaveDir + '/page-' + pageNumber + '.png' ;

    fs.exists(given.pageSaveLocation, function(exists) {

      console.log('file exists:', exists) ;

      if(exists) {
        //we done! cb!
        cb() ;
      }
      else{

        console.log('starting file download request') ;

        var startTime = new Date().getTime() ;

        console.log('downloading ', pageImageURL) ;

        https.get(pageImageURL, function(response) {

          var imageData = '' ;

          response.setEncoding('binary') ;

          response.on('data', function(chunk) {
            console.log('writing data') ;
            imageData += chunk;
          });

          response.on('end', function () {

            console.log('end of receiving') ;
    
            fs.writeFile(given.pageSaveLocation, imageData, 'binary', function(err){

              if(err) {
                throw err;
              }

              console.log('TOTAL TIME: ', (new Date().getTime() - startTime) / 1000) ;

              console.log('File: ' + given.pageSaveLocation + ' written!');

              cb() ; //callback!

            }) ;

          });

        });

      }

    });

  }, //downloadPage

} ;

Server.init() ;