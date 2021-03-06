"use strict";

var global_upload_done = false;
var global_upload_callback;

function upload_single_file(file, callback)
{
	// generate a fixed length filename for the terminal
	var name_length = 30;
	var name_short =
		file.name.length>name_length ? file.name.substr(0,name_length-3)
		: file.name;
	while(name_short.length < name_length) name_short+=".";
	
	
	// progress bar for the terminal, something like:
	// Psy - Gangname Style.mp3   4.3 M/s 00:05 [===>          ]  30%
	// TODO: speed, time remaining
	var progress = line("");
	var progress_timestamp = +new Date();
	var progress_update = function(e)
	{
		// only redraw the progress bar every 100ms
		if((progress_timestamp + 100 >= +new Date())
			&& (!e||!e.target.status))
			return;
		
		progress_timestamp = +new Date();
		var percent_done = null;
		
		if(e)
		{
			if(e.lengthComputable)
				percent_done = Math.round(e.loaded*1000/file.size)/10;
			if(e.target.status==200)
				percent_done = 100;
		}
		
		progress.innerHTML="";
		progress.appendChild(document.createTextNode(name_short));
		
		// draw progress bar
		var text=" [";
		var progressbar_length = 30; // todo: adjust to window size
		for(var i=0;i<progressbar_length;i++)
		{
			if(i/progressbar_length * 100 > percent_done)
				text+=" ";
			else
				text+="=";
		}
		text+="]";
		
		// add the cool arrow
		for(var i=text.length - progressbar_length;i<text.length-1;i++)
		{
			if(text[i+1] != " " && text[i+1] != "]") continue;
			text = text.substr(0, i-1) + ">" + text.substr(i+1);
			break;
		}
		
		if(percent_done) text += " "+percent_done+"%";
		progress.innerHTML+=text;
		
		
		// check if the upload is done
		// TODO: check if this works in firefox. previous condition:
		// e.lengthComputable && e.loaded == file.size
		if(e && e.target.status==200) callback();
	};
	progress_update();
	
	
	var progress_error = function()
	{
		line("Couldn't complete the upload, please try again!");
	};
	
	
	// create the form
	var fd = new FormData();
	fd.append('file', file);
	
	
	// create the XHR with all callbacks
	var xhr = new XMLHttpRequest();	
	xhr.upload.addEventListener("progress", progress_update, false);
	xhr.addEventListener("load", progress_update, false);
	xhr.addEventListener("error", progress_error, false);
	xhr.addEventListener("abort", progress_error, false);
	xhr.open("POST","api/upload?sid="+global_sid,true);
	xhr.send(fd);
}


function upload_all(callback, index)
{
	index = index || 0;
	if(index >= $("file").files.length) return callback();
	
	upload_single_file($("file").files[index], function()
	{
		// don't increase the function call stack -> setTimeout
		setTimeout(function()
		{
			index++;
			upload_all(callback, index);
		},0);
	});
}

function upload_start()
{
	ui_disable_buttons();

	var files = $("file").files;
	var total_size = 0;
		
	for(var i=0;i<files.length;i++)
		total_size+= files[i].size;
	
	var c = files.length;
	line("Uploading "+c+" file" + (c==1?"":"s")
		+ " ("+Math.floor(total_size/1024/1024*10)/10+" MiB):");
	
	$("file").style.display="none";
	window.focus();
	
	upload_all(function()
	{
		if(global_upload_done) return;
		global_upload_done = true;
		line("Upload finished!");
		global_upload_callback();
	});
}

