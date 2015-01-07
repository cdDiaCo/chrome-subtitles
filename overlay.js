function router(request, sender, callback) {
  addOverlay();
}

chrome.extension.onMessage.addListener(router);

var overlay = $("<div></div>");
var area = $("<div></div>");
var areaLeft, areaTop;
var srt, movement;
var newSrt = [];
var subMovedAtLeastOnce = false;
var initialized = false;
var srtIsPaused = false;
var resumeSrt = false;
var isSubPlaying = false;

var subUpload = $('<input type="file" id="file" name="files[]"/>')
subUpload.css({background:"white"});
overlay.append(subUpload);


function handleFileSelect(evt) {
  var files = evt.target.files; 

  var reader = new FileReader();
  reader.onloadend = function (evt) {
    var data = evt.target.result;
    srt = parseSrt(data); // str is the array containing the sub objects
    currentStrIndex = 0;
  }

  reader.readAsText(files[0]); // get info about the uploaded file
}

subUpload.on('change', handleFileSelect, false);
subUpload.on('mousedown mousemove mouseup', function (e) { e.stopPropagation(); }, false)

var firstDate;
var secondDate;

function addOverlay() {
  if(initialized) {
   //    overlay.css({pointerEvents: "none"});
    overlay.css({background: "none", opacity: "0.9", height:50});
	
    // the area where the subtitles appear	
    area.css({
      left:areaLeft-50,
      top:areaTop,
      background: "none",
      //border: "50px solid black",
      pointerEvents: "none"
    });
    overlay.show();
    firstDate = new Date();
    playSubs(srt);
    return;
  }

  var width = $("body").width(), height = $("body").height();
  overlay.css({
    top: "0px", left: "0px",
    position: "fixed",
    width: width + "px",
    height: height + "px",
    background: '#111',
    opacity: "0.5",
    zIndex: "99999999"
  });

  $("body").append(overlay);
  
  area.css({
    position: "absolute",
    width: "100px",
    height: "100px",
    background:"white"
  });

  overlay.on("mousedown", function (e) {
    areaLeft = e.clientX;
    areaTop = e.clientY;
    area.css({
      left: areaLeft + "px",
      top: areaTop + "px"
    });
    overlay.append(area);
  });

  overlay.on("mousemove", function (e) {    	
    var w = (e.clientX-areaLeft);
    var h = (e.clientY-areaTop);
    area.css({
      width: w + "px",
      height: h + "px"
    });
    subLine.css({
      width: (w-40) + "px",
      height: h + "px"
    });
  });

  // this is related to the click-drag rectangle over the area
  overlay.on("mouseup", function (e) {
    //alert('in mouseup');
    $('#play').css({width: "1100px"}); // optional
    $('#video_wrapper').css({height: "600px"});	// optional	
    //initialized = true;
    overlay.off();
    subLine.css({marginTop: area.height()-54});
    currentStrIndex = 0;
    initialized = true;
    overlay.hide();    
  });
}

var subLine = $("<div></div>")
subLine.css({
  fontSize: "22px",
  color: "white",
  marginLeft: 20,
  marginRight: 20,
  paddingBottom: 2,
  pointerEvents: "none"
});
var line1 = $("<p></p>").css({margin:0, paddingLeft: 10, background: "black"}).css({marginBottom: 5});
var line2 = $("<p></p>").css({margin:0, paddingLeft: 10, background: "black"});
subLine.append(line1).append(line2);
area.append(subLine);



var timer;

$(document).on("keydown", function (e) {
  if(e.keyCode == 39) { // right arrow
    secondDate = new Date();
    currentStrIndex -= 1;    
    movement = "forward";
    moveSub();    
  } else if(e.keyCode == 37) { // left arrow
    currentStrIndex -= 2;
    currentStrIndex = Math.max(currentStrIndex, 0)
    secondDate = new Date();    
    movement = "backward";
    moveSub();
  }   
  else if(e.keyCode == 32) { // space key is pressed     
     if(srtIsPaused) { //srt already paused 
        // continue playing the srt 
        srtIsPaused = false; 
        resumeSrt = true;
        playSubs(srt, false);
     } else {
        // pause the srt
        srtIsPaused = true; 
        clearTimeout(timer);        
     }     
  } 
});


function moveSub() {  
  if(!srt) { return; }
  clearTimeout(timer);
  subMovedAtLeastOnce = true;
  playSubs(srt, true);
}
var currentStrIndex = 0;


function playSubs(srt, moving) {  
  isSubPlaying = true; 
  var currentTime = 0; 
  if(resumeSrt) { currentTime = srt[currentStrIndex].start; }  
  
  if(moving) {       	
      currentTime = srt[currentStrIndex].start;	// the subtitle will appear immediately - 0 mlseconds  
      if(movement === "forward") { resynchronizeSrtForward(); }
      else { resynchronizeSrtBackward(); }      
  }

  function resynchronizeSrtForward() {
      var diffDates = secondDate - firstDate;
      var numOfSec = diffDates/1000; 
      var differenceSecondsToBeAdded, newStartTime, newEndTime;       
      
      for(var i=currentStrIndex; i<srt.length; i++) {
           if(i===currentStrIndex) { // get newStartTime for the obj that triggered the resync
              newStartTime = fromSecondsToString(numOfSec);
              differenceSecondsToBeAdded = srt[i].start/1000 - numOfSec;  // oldStart - newStart                                     
           } else {
              newStartTime = getNewStartTime(differenceSecondsToBeAdded, srt[i].start/1000, "forward");
           }
           newEndTime = getNewEndTime(differenceSecondsToBeAdded, srt[i].end/1000, "forward");       
           
           //if obj with key already exists
           if(newSrt[i]) {                          
                if (newSrt[i].objKey === srt[i].objKey) {                    
                    newSrt[i].start = newStartTime;
                    newSrt[i].end = newEndTime;
                }
           } else {
                // if obj doesn't exist in new array already                
                var newSubObj = {objKey: srt[i].objKey, start: newStartTime, end: newEndTime, 
                                    line1: srt[i].line1 };
                newSrt.push(newSubObj);  
                if(srt[i].line2) {newSubObj.line2=srt[i].line2;}
           }
      }      
  }


  function resynchronizeSrtBackward() {
      var diffDates = secondDate - firstDate;
      var numOfSec = diffDates/1000; 
      var differenceSecondsToBeAdded, newStartTime, newEndTime; 

      for(var i=currentStrIndex; i<srt.length; i++) {
           if(i===currentStrIndex) { // get newStartTime for the obj that triggered the resync
               newStartTime = fromSecondsToString(numOfSec);
               differenceSecondsToBeAdded = numOfSec - srt[i].start/1000;  // newStart - oldStart 
           } else {
              newStartTime = getNewStartTime(differenceSecondsToBeAdded, srt[i].start/1000, "backward");
           }
           newEndTime = getNewEndTime(differenceSecondsToBeAdded, srt[i].end/1000, "backward"); 
     
           //if obj with key already exists
           if(newSrt[i]) {                          
                if (newSrt[i].objKey === srt[i].objKey) {                    
                    newSrt[i].start = newStartTime;
                    newSrt[i].end = newEndTime;
                }
           } else {
                // if obj doesn't exist in new array already                
                var newSubObj = {objKey: srt[i].objKey, start: newStartTime, end: newEndTime, 
                                    line1: srt[i].line1 };
                newSrt.push(newSubObj);  
                if(srt[i].line2) {newSubObj.line2=srt[i].line2;}
           }
      }      
  }

  function getNewEndTime(diff, oldEndTime, movementType) { 
        var  newEndTime;
        if(movementType === 'forward') { newEndTime = oldEndTime - diff; }
        else { newEndTime = oldEndTime + diff; } 
        newEndTime = fromSecondsToString(newEndTime);    
	return newEndTime;
  } 

  function getNewStartTime(diff, oldStartTime, movementType) {
	var newStartTime;
        if(movementType === 'forward') { newStartTime = oldStartTime - diff; }
        else { newStartTime = oldStartTime + diff; }
        newStartTime = fromSecondsToString(newStartTime); 
        return newStartTime;
  }

  function fromSecondsToString(numOfSec) {
      var newStringTime;
      if(numOfSec >=60 ) {
           var minutes, sec, mlsec;  
           var hours = '00:';       
           var modulo = numOfSec % 60;
           minutes = (numOfSec - modulo)/60;

           if(minutes>60) { hours='0'+ parseInt(minutes/60); minutes=minutes%60; }
           else if(minutes==60) {hours='01'; minutes=0;} 

           modulo = modulo.toFixed(3);
           var n = modulo.toString();
           if(n.indexOf(".") > -1) {
             var arr = n.split('.');
             sec = arr[0];
             mlsec = arr[1];
           } 
           if(sec<10) { sec = '0'+sec; }
           if(minutes<10) { minutes = '0'+minutes; }           
           newStringTime = '00:'+minutes+':'+sec+','+mlsec;
      } else {
           numOfSec = numOfSec.toFixed(3);
           var n = numOfSec.toString();
           if(n.indexOf(".") > -1) {
             var arr = n.split('.');
             sec = arr[0];
             mlsec = arr[1];
           } 
           if(sec<10) { sec = '0'+sec; }
           newStringTime = '00:00:'+sec+','+mlsec;  
      }      
      
      return newStringTime; 
  }   

  function showNextSub() {           
    line1.hide(); line2.hide();
    var sub = srt[currentStrIndex];  
    if(!moving && !subMovedAtLeastOnce && sub) { 
        var convertedStartTime = fromSecondsToString(sub.start/1000);
        var convertedEndTime = fromSecondsToString(sub.end/1000);
        var convertedSub = {objKey: sub.objKey, start: convertedStartTime, end: convertedEndTime, 
                                    line1: sub.line1};
        newSrt.push(convertedSub);  
        if(sub.line2) {convertedSub.line2=sub.line2;}
    }  
    if(sub) {
      currentStrIndex += 1;
      showSub(sub);
    } else if(subMovedAtLeastOnce) { saveToDisk();  }
    
  }

  function showSub(sub) {        
    timer = setTimeout(function () {
      currentTime = sub.start;
      line1.text(sub.line1); line1.show();
      if(sub.line2) { line2.text(sub.line2); line2.show(); }
      timer = setTimeout(showNextSub, sub.end - currentTime);
      currentTime = sub.end;
    }, sub.start - currentTime);
  }

  showNextSub();

  function writeNewSrt() {
      var content = "";
      for(var i=0; i<newSrt.length; i++) {
          content += newSrt[i].objKey + "\n";
          content += newSrt[i].start + " --> " + newSrt[i].end + "\n";
          content += newSrt[i].line1 + "\n"; 
          if(newSrt[i].line2) { content += newSrt[i].line2 + "\n"; }
          content += "\n"; 
      }       
      return content;
   }

   function saveToDisk() {
      var content = writeNewSrt();
      var aFileParts = [content];
      var a = document.createElement('a');
      var blob = new Blob(aFileParts, {'type' : 'text/html'});
      a.href = window.URL.createObjectURL(blob);
      a.download = 'newGeneratedSubtitle.srt';
      a.click();
   }     
   
}

function toMs(timeStr) {     
    var spl = timeStr.split(",");    
    var time = spl[0].split(":"), ms = parseInt(spl[1], 10);    
    var h = parseInt(time[0], 10), m = parseInt(time[1], 10), s = parseInt(time[2], 10);
    return ms + (s + m*60 + h*60*60)*1000;
}

function parseSrt(data) {
  var lines = data.split("\n"); // all the lines from the subtitle file
  var res = []; // an array with sub objects that will be returned   	

  for(var i = 0, j = 1; i < lines.length; i++) {
    var line = lines[i];
    var m = line.match(/(.*)\s-->\s(.*)/)
    if(m) {
      var start = m[1], end = m[2]; // where start is the appearence time 
      // and end is the dissapearence time of the subtitle
      var sub = {objKey: j, start: toMs(start), end: toMs(end)}; 

      var line1 = lines[i+1];
      var line2 = lines[i+2];
      sub.line1 = line1; // add the first line to the sub obj       
      res.push(sub);  // add the sub obj to the res array 
      j++; 
      i += 2;
      if(line2.trim().length > 0) {
        sub.line2 = line2; // if exists add the second line to the sub obj
        i += 1;
      }
    }
  }
  return res;
}
