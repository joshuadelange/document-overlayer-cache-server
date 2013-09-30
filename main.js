var http = require('http'),
    https = require('https'),
    fs = require('fs'),
    saveDir = process.env[(process.platform === 'win32') ? 'USERPROFILE' : 'HOME'] + '/Documents/document-overlayer-cache/' ;

//double check!
fs.mkdir(saveDir, function(){}) ;

http.createServer(function (req, res) {

  res.setHeader('Access-Control-Allow-Origin', '*');

  var Server = {

    url: '',
    documentName: '',
    docSaveDir: '',

    baseImageURL: '',
    numberOfPages: '',

    pageNumber: null,
    pageSaveLocation: '',
    pageWidth: 1080,

    isRetryingAfter404: false,

    log: function(){
      var args = [] ;
      for(var key in arguments) { args.push(arguments[key]) ; }

      var message = JSON.stringify(args).replace('{', '').replace('}', '').replace(':', '').replace(',', '').replace('"', '').replace('[', '').replace(']', '') ;
      console.log(message) ;
      $('.log').prepend('<li>' + message + '</li>') ;

    },

    init: function(){

      var given = this ;

      var urlParts = req.url.split('/') ;
      given.log('url parts', urlParts) ;

      //first parameter = url (of google doc viewer)
      if(urlParts[1].indexOf('http') > -1) {

        given.url = decodeURIComponent(urlParts[1]) ;
        given.loadDocument(function(){

          if(urlParts[2] && parseInt(urlParts[2], 10) > 0) {

            given.log(given.documentName, given.pageNumber, 'got an page number!', given) ;

            given.pageNumber = parseInt(urlParts[2], 10) ;

            given.downloadPage(given.pageNumber, function(){

              given.log(given.documentName, given.pageNumber, 'got page') ;

              //output png here
              var img = fs.readFileSync(given.pageSaveLocation);
              res.writeHead(200, {'Content-Type': 'image/png'});
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
  
        given.log('Connected to client!') ;

        //for the sake of pinging
        res.writeHead(200, {'Content-Type': 'text/plain'});
        res.end('server is ready for caching');

      }

    }, //init

    loadDocument: function(cb){

      var given = this,
          stuffWeDontCareAbout = 'https://docs.google.com/viewer?url=https://dl.dropboxusercontent.com/s/' ;

      given.documentName = decodeURIComponent(decodeURIComponent(given.url).replace(stuffWeDontCareAbout, '').split('/')[1].split('?')[0]) ;

      given.log(given.documentName, given.pageNumber, ' is loading') ;

      given.docSaveDir = saveDir + given.documentName.replace(' ', '-').replace('.', '-') + '/' ;

      //create folder
      fs.mkdir(given.docSaveDir, function() {

        //check if info exists
        fs.exists(given.docSaveDir + '_info.txt', function(exists) {

          given.log(given.documentName, given.pageNumber, given.docSaveDir + '_info.txt', 'info exists', exists) ;

          if(exists) {

            given.log(given.documentName, given.pageNumber, 'reading info', given.docSaveDir + '_info.txt') ;

            //read the info!
            fs.readFile(given.docSaveDir + '_info.txt', function(err, f){

              if(err) throw err ;

              var params = JSON.parse(f.toString()) ;

              given.baseImageURL = params.baseImageURL ;
              given.numberOfPages = params.numberOfPages ;

              given.log(given.documentName, ' is cached') ;

              //fire callback!
              cb() ;

            });

          }
          else {

            given.log(given.documentName, given.pageNumber, 'info doesnt exist, scraping iframe') ;

            $('.log').prepend('<li>' + given.documentName + ': Waiting for Google\'s magic...</li>') ;

            var $iframe = $('<iframe />').attr('src', given.url).attr('data-name', given.documentName) ;
            $('body').append($iframe) ;

            $('iframe[data-name="' + given.documentName + '"]').load(function(){

              fs.mkdir(given.docSaveDir, function(){

                given.log(given.documentName, given.pageNumber, 'iframe loaded') ;

                given.baseImageURL = 'https://docs.google.com/viewer' + $('iframe[data-name="' + given.documentName + '"]').contents().find('.page-image:nth-of-type(2)').attr('src').replace(/(&w=\d+)/, '&w=' + given.pageWidth) ;

                var rawNumberOfPages = $('iframe[data-name="' + given.documentName + '"]').contents().find('#controlbarPageNumber').html() ;
                given.numberOfPages = (rawNumberOfPages !== undefined) ? parseInt($('iframe[data-name="' + given.documentName + '"]').contents().find('#controlbarPageNumber').html().split(' / ')[1], 10) : 0 ;

                fs.writeFileSync(given.docSaveDir + '_info.txt', JSON.stringify(given), 'UTF-8', {'flags': 'w+'});

                given.log(given.documentName, given.pageNumber, 'iframe scraped!') ;

                cb(); //ready for

              }) ;

            }) ;

          }
        
        }) ;
      
      }) ;

    }, //load document

    downloadNextPage: function(i){

      var given = this ;
      given.downloadPage(i, function(){

        if(i > 1) {
          given.downloadNextPage(i - 1) ;
        }
    
        if(i === 1) {
          $('iframe[data-name="' + given.documentName + '"]').remove() ;
        }

      }) ;

    },

    downloadPage: function(pageNumber, cb){

      var given = this,
          pageImageURL = given.baseImageURL.replace('pagenumber=1', 'pagenumber=' + pageNumber) ;

      given.log(given.documentName, given.pageNumber, 'attemtping to save page ', pageNumber) ;
      
      given.pageSaveLocation = given.docSaveDir + 'page-' + pageNumber + '.png' ;

      fs.exists(given.pageSaveLocation, function(exists) {

        given.log(given.documentName, given.pageNumber, 'file exists:', exists) ;

        if(exists) {
          //we done! cb!
          cb() ;
        }
        else{

          given.log(given.documentName, given.pageNumber, 'starting file download request') ;

          var startTime = new Date().getTime() ;

          given.log(given.documentName, given.pageNumber, 'downloading ', pageImageURL) ;

          https.get(pageImageURL, function(response) {

            var imageData = '' ;

            response.setEncoding('binary') ;

            response.on('data', function(chunk) {
              given.log(given.documentName, given.pageNumber, 'writing data!') ;
              imageData += chunk;
            });

            response.on('end', function () {

              given.log(given.documentName, given.pageNumber, 'end of receiving') ;

              if(imageData.length < 150) {

                given.log(given.documentName, given.pageNumber, 'probably 404 error') ;

                if(given.isRetryingAfter404) {
                  given.log(given.documentName, given.pageNumber, 'page does not exist') ;
                }
                else {
                  given.log(given.documentName, given.pageNumber, 'retrying') ;
                  fs.unlink(given.pageSaveLocation, function(){
                    given.downloadPage(pageNumber, cb) ;
                    given.isRetryingAfter404 = true ;
                  }) ;
                }

              }
              else {
      
                fs.writeFile(given.pageSaveLocation, imageData, 'binary', function(err){

                  if(err) {
                    throw err;
                  }

                  given.log(given.documentName, given.pageNumber, 'TOTAL TIME: ', (new Date().getTime() - startTime) / 1000) ;

                  given.log(given.documentName, given.pageNumber, 'File: ' + given.pageSaveLocation + ' written!');

                  cb() ; //callback!

                }) ;

              }

            });

          });

        }

      });

    }, //downloadPage

  } ;

  Server.init() ;

}).listen(1337, '127.0.0.1');

$('.status').html('Ready for caching') ;
