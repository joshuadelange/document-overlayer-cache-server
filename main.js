var http = require('http'),
    https = require('https'),
    fs = require('fs') ;

http.createServer(function (req, res) {

  res.setHeader('Access-Control-Allow-Origin', '*');

  var Server = {

    saveDir: process.env[(process.platform === 'win32') ? 'USERPROFILE' : 'HOME'] + '/Documents/document-overlayer-cache/',

    url: '',
    documentName: '',
    docSaveDir: '',

    baseImageURL: '',
    numberOfPages: '',

    pageNumber: null,
    pageSaveLocation: '',
    pageWidth: 1080,

    init: function(){

      var given = this ;

      var urlParts = req.url.split('/') ;
      console.log('url parts', urlParts) ;

      //first parameter = url (of google doc viewer)
      if(urlParts[1].indexOf('http') > -1) {

        given.url = decodeURIComponent(urlParts[1]) ;
        given.loadDocument(function(){

          if(urlParts[2] && parseInt(urlParts[2], 10) > 0) {

            console.log(given.documentName, 'got an page number!', given) ;

            given.pageNumber = parseInt(urlParts[2], 10) ;

            given.downloadPage(given.pageNumber, function(){

              console.log(given.documentName, 'got page') ;

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
  
        $('.log').prepend('<li>Connected to the client</li>') ;

        //for the sake of pinging
        res.writeHead(200, {'Content-Type': 'text/plain'});
        res.end('server is ready for caching');

      }

    }, //init

    loadDocument: function(cb){

      var given = this,
          stuffWeDontCareAbout = 'https://docs.google.com/viewer?url=https://dl.dropboxusercontent.com/s/' ;

      given.documentName = decodeURIComponent(decodeURIComponent(given.url).replace(stuffWeDontCareAbout, '').split('/')[1].split('?')[0]) ;

      console.log('doc name', given.documentName) ;

      given.docSaveDir = given.saveDir + given.documentName.replace(' ', '-').replace('.', '-') + '/' ;

      //create folder
      fs.mkdir(given.docSaveDir, function() {

        //check if info exists
        fs.exists(given.docSaveDir + '_info.txt', function(exists) {

          console.log(given.documentName, given.docSaveDir + '_info.txt', 'info exists', exists) ;

          if(exists) {

            console.log(given.documentName, 'reading info', given.docSaveDir + '_info.txt') ;

            //read the info!
            fs.readFile(given.docSaveDir + '_info.txt', function(err, f){

              if(err) throw err ;

              var params = JSON.parse(f.toString()) ;

              given.baseImageURL = params.baseImageURL ;
              given.numberOfPages = params.numberOfPages ;

              $('.log').prepend('<li>Found ' + given.documentName + ' in cache') ;

              //fire callback!
              cb() ;

            });

          }
          else {

            console.log(given.documentName, 'info doesnt exist, scraping iframe') ;

            $('.log').prepend('<li>' + given.documentName + ': Waiting for Google\'s magic...</li>') ;

            var $iframe = $('<iframe />').attr('src', given.url).attr('data-name', given.documentName) ;
            $('body').append($iframe) ;

            $('iframe[data-name="' + given.documentName + '"]').load(function(){

              fs.mkdir(given.docSaveDir, function(){

                console.log(given.documentName, 'iframe loaded') ;

                given.baseImageURL = 'https://docs.google.com/viewer' + $('iframe').contents().find('.page-image:nth-of-type(2)').attr('src').replace(/(&w=\d+)/, '&w=' + given.pageWidth) ;

                var rawNumberOfPages = $('iframe[data-name="' + given.documentName + '"]').contents().find('#controlbarPageNumber').html() ;
                given.numberOfPages = (rawNumberOfPages !== undefined) ? parseInt($('iframe[data-name="' + given.documentName + '"]').contents().find('#controlbarPageNumber').html().split(' / ')[1], 10) : 0 ;

                fs.writeFileSync(given.docSaveDir + '_info.txt', JSON.stringify(given), 'UTF-8', {'flags': 'w+'});

                $('.log').prepend('<li>' + given.documentName + ': Downloading ' + given.numberOfPages + '</li>') ;

                console.log(given.documentName, 'iframe scraped!') ;

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
    
        $('.log li:first').html('<li>Downloading ' + i + '/' + given.numberOfPages + ' pages for ' + given.documentName + '</li>') ;

        if(i > 1) {
          given.downloadNextPage(i - 1) ;
        }
    
        if(i === 1) {
          $('.log').prepend('<li>Finished downloading ' + given.documentName + '</li>') ;
          $('iframe[data-name="' + given.documentName + '"]').remove() ;
        }

      }) ;

    },

    downloadPage: function(pageNumber, cb){

      var given = this,
          pageImageURL = given.baseImageURL.replace('pagenumber=1', 'pagenumber=' + pageNumber) ;

      console.log(given.documentName, 'attemtping to save page ', pageNumber) ;
      
      given.pageSaveLocation = given.docSaveDir + 'page-' + pageNumber + '.png' ;

      fs.exists(given.pageSaveLocation, function(exists) {

        console.log('file exists:', exists) ;

        if(exists) {
          //we done! cb!
          cb() ;
        }
        else{

          console.log(given.documentName, 'starting file download request') ;

          var startTime = new Date().getTime() ;

          console.log(given.documentName, 'downloading ', pageImageURL) ;

          https.get(pageImageURL, function(response) {

            var imageData = '' ;

            response.setEncoding('binary') ;

            response.on('data', function(chunk) {
              console.log(given.documentName, 'writing data!') ;
              imageData += chunk;
            });

            response.on('end', function () {

              console.log(given.documentName, 'end of receiving') ;

              if(imageData.length < 150) {

                console.log('probably 404 error, trying again') ;

                fs.unlink(given.pageSaveLocation, function(){
                  given.downloadPage(pageNumber, cb) ;
                }) ;

              }
              else {
      
                fs.writeFile(given.pageSaveLocation, imageData, 'binary', function(err){

                  if(err) {
                    throw err;
                  }

                  console.log(given.documentName, 'TOTAL TIME: ', (new Date().getTime() - startTime) / 1000) ;

                  console.log(given.documentName, 'File: ' + given.pageSaveLocation + ' written!');

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
