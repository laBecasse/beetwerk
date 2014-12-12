"use strict";

var global_sid = +new Date();
var global_poll_version = 0;
var global_process_running = false; // is beets/youtube-dl running?
var global_question_callback;
var global_exec_callback; // will get the return code as parameter

function $(a) {return document.getElementById(a);}

function check_answer(valid, answer, is_not_a_number /*=false*/)
{
	if(!is_not_a_number) answer = 1*answer;
	if(valid.indexOf(answer) > -1) return true;
	
	line("").innerHTML="You fucked up and need to <a href='/'>reload</a> the page.";
	global_question_callback = function(){line("You heard me.");};
	throw "invalid input fuckup";
}


function xhr(url,callback)
{
	var xhr = new XMLHttpRequest();
	url = "/api/"+url+(url.indexOf("?")>-1?"&":"?")+"sid="+global_sid;
	xhr.open("GET", url, true);
	xhr.onreadystatechange = function()
	{
		if(xhr.readyState != 4) return;
		if(callback) return callback(JSON.parse(xhr.responseText));
	}
	xhr.send();
}

// Detect multiple choice selections and make them clickable.
// All created buttons have the inline_button class, so they
// can be reset (class, onclick) by the terminal_send function.
function buttonize(text)
{
	// List of album candidates. They always start with the index
	// number, followed by a dot.
	var index = text.split(".")[0]*1;
	if(index > 0)
		return '<span class="inline_button" '
			+ 'onclick="terminal_send('+index+')">'
			+ text +'</span>';
	
	
	// Multiple options in one line, such as:
	// Skip, Use as-is, as Tracks, Group albums, ...
	// Typical colors are blue and cyan.
	var multiple_choice_colors = ["[34;01m", "[36;01m"];
	var options = text.split(",");
	var changed = false;
	for(var i=0;i<options.length;i++)
	{
		var opt = options[i];
		var key = null;
		
		for(var j=0;j<multiple_choice_colors.length;j++)
		{
			var color = multiple_choice_colors[j];
			var pos = opt.indexOf(color);
			if(pos == -1) continue;
			
			// Sometimes the key is in brackets
			key = opt.substr(pos + color.length, 2);
			key = key[0] == "[" ? key[1] : key[0];
		}
		if(!key) continue;
		
		options[i] = '<span class="inline_button" '
			+ 'onclick="terminal_send(\'' + key + '\')">'
			+ opt.trim() +'</span>';
		changed = true;
	}
	
	if(!changed) return text;
	return options.join(", ");
}

// lazy color replacement for just the colors we need
function colorize(text)
{
	var codes = 
	{
		"[39;49;00m"	: "white",
		"[31;01m"		: "red",
		"[33;01m"		: "yellow",
		"[37m"			: "gray",
		"[36;01m"		: "cyan",
		"[34;01m"		: "rgb(030,107,223)", // blue
		"[32;01m"		: "rgb(000,255,000)", // green
	};
	
	for(var code in codes)
	{
		var color = codes[code];
		
		// all codes are prefixed with the
		// escape character
		while(text.indexOf(""+code)>-1)
		{
			text = text.replace(""+code,
				"<font style='color:"+color+"'>");
			text+= "</font>";
		}
	}
	return text;
}

// Print a new line of text to the terminal. The text variable may contain
// HTML code, which will then be automatically escaped. If you want to
// display custom HTML, call the function this way:
// line("","blue").innerHTML="Some <i>HTML</i> magic!";
function line(text, /*optional*/ color)
{
	var term = $("terminal");
	var pre = document.createElement("pre");
	
	
	/*
		youtube-dl throws back lots of [download] lines (in one function
		call of line()!) with the current status. Limit this to one line,
		and remove the previous ones.
	*/
	if(!text) text = " ";
	text = ""+text;
	if(text && text.indexOf("[download]") > -1)
	{
		var old = $("ytdl-status");
		if(old) old.parentNode.removeChild(old);
		
		var dl = text.split("[download]");
		text = "[download]"+dl[dl.length -1];
		pre.id="ytdl-status";
	}
	
	// Disable youtube-dl messages that say it won't convert audio files
	if(text.indexOf("[youtube] Post-process file ") > -1) return;
	
	// only scroll, if the terminal is already scrolled to the bottom!
	// FIXME: doesn't always work
	var dont_scroll =
		term.scrollHeight > term.scrollTop + term.offsetHeight + 15;
	
	pre.appendChild(document.createTextNode(text));
	term.appendChild(pre);
	
	pre.innerHTML = buttonize(pre.innerHTML);
	pre.innerHTML = colorize(pre.innerHTML);
	if(color) pre.style.color = color;
	
	// lazy clickable links, enough for beet import
	// source: http://stackoverflow.com/a/1500501
	pre.innerHTML = pre.innerHTML.replace(/(https?:\/\/[^\s]+)/g,
		'<a href="$1" target="_blank">$1</a>')
	
	if(!dont_scroll) term.scrollTop = term.scrollHeight
		- term.offsetHeight - 5;
	
	
	scrollbar_draw();
	return pre;
}

function terminal_poll()
{
	xhr("poll?version="+global_poll_version,function(answer)
	{
		// if we got something just now, try again without waiting
		if(answer != null)
		{
			var lines = answer.string.split('\n');
			for(var i=0;i<lines.length;i++)
			{
				// don't show notification from youtube-dl, that it has
				// just deleted the video file (after extracting the audio),
				// because that is just what we want it to do
				if(lines[i].indexOf("(pass -k to keep)") > -1)
					continue;
				line(lines[i]);
			}
			
			global_poll_version = answer.version;
			if(!answer.is_running) global_process_running = false;
		}
		if(global_process_running)
			setTimeout(terminal_poll, answer ? 0 : 500);
		else
			global_exec_callback(answer.exit_code);
	});
}

// Disable all inline buttons (generated by buttonize)
function ui_disable_buttons()
{
	while(true)
	{
		var button = document.getElementsByClassName("inline_button")[0];
		if(!button) break;
		button.onclick = button.className = "";
	}
}

function terminal_send(/*optional*/val)
{
	val = val || $("commandline").value || "";
	
	ui_disable_buttons();
	
	if(global_process_running)
	{
		// Display the input after it has been received by the server
		xhr("send?string="+encodeURIComponent(val+'\n'), function(answer)
		{
			if(answer) line(val, "purple");
		});
	}
	else
	{
		if(val) line(val, "purple");
		else line("", "purple").innerHTML="<i>default</i>";
		global_question_callback(val);
	}
	
	$("commandline").value = "";
}
