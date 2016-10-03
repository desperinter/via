/*
 * VGG Image Annotator (via)
 *
 * Copyright (C) 2016, Abhishek Dutta <adutta@robots.ox.ac.uk>
 * Aug. 31, 2016
 */

var VIA_VERSION = "0.1b";
var image_panel_width, image_panel_height;
var canvas_width, canvas_height;

var user_uploaded_images;
var image_filename_list = [];
var current_image_index = -1;
var current_image_id = '';
var current_image_filename;

var current_image;
var current_image_loaded = false;

var user_drawing_bounding_box = false;
var user_entering_annotation = false;
var click_x0 = 0; var click_y0 = 0;
var click_x1 = 0; var click_y1 = 0;

var bounding_box_count = 0;
var annotation_count = 0;
var annotations = new Map();
var annotation_keys = [];
var current_annotation_bounding_box_id = -1;
var current_selected_bounding_box_index = -1;
var annotation_attributes = new Set();

// bounding box coordinates in original image space
var x0 = new Map(); var y0 = new Map(); var x1 = new Map(); var y1 = new Map();

var image_annotation_list = new Map();
var image_id_list = [];

// bounding box coordinates in original canvas space
var canvas_x0 = new Map(); var canvas_y0 = new Map();
var canvas_x1 = new Map(); var canvas_y1 = new Map();
var scale_factor = new Map(); // canvas_x0 = x0 * scale_factor

var status_prefix = "";

var image_canvas = document.getElementById("image_canvas");
var image_context = image_canvas.getContext("2d");

var home_button = document.getElementById("home_button");;
var load_images_button = document.getElementById("load_images_button");
var help_button = document.getElementById("help_button");
var home_button = document.getElementById("home_button");
var delete_annotations_button = document.getElementById("delete_annotations_button");

var invisible_file_input = document.getElementById("invisible_file_input");
var json_download_link = document.getElementById("link_download_annotations");

var status_bar = document.getElementById("status_bar");
var navigation_info = document.getElementById("navigation_info");
var annotation_info = document.getElementById("annotation_info");
var info_bar = document.getElementById("info_bar");
var via_session_data_panel = document.getElementById("via_session_data_panel");
var image_annotation_list_snippet = document.getElementById("image_annotation_list_snippet");

var container = document.getElementById("container");
var main_content = document.getElementById("main_content");
var starting_information_panel = document.getElementById("starting_information");
var help_panel = document.getElementById("help_panel");
var container = document.getElementById("container");

var annotation_textbox = document.getElementById("annotation_textbox");    
annotation_textbox.style.visibility = "hidden";

var save_via_session_data_button = document.getElementById("save_via_session_data_button");

var is_window_resized = false;

var is_user_resizing_bounding_box = false;
var bounding_box_edge = [-1, -1];
var bounding_box_edge_tol = 5;

var bounding_box_being_moved = false;
var box_click_x, box_click_y;

var zoom_active = false;
var ZOOM_SIZE_PERCENT = 0.2;
var zoom_size_img = -1;
var zoom_size_canvas = -1;
var ZOOM_BOUNDARY_COLOR = "#ffaaaa";
var is_local_storage_available = false;

var COLOR_KEY = "#0000FF";
var COLOR_VALUE = "#000000";
var COLOR_MISSING_VALUE = "#FF0000";

var BBOX_LINE_WIDTH = 4;
var BBOX_BOUNDARY_FILL_COLOR_ANNOTATED = "#f2f2f2";
var BBOX_BOUNDARY_FILL_COLOR_NEW = "#aaeeff";
var BBOX_BOUNDARY_LINE_COLOR = "#1a1a1a";
var BBOX_SELECTED_FILL_COLOR = "#ffffff";
var BBOX_SELECTED_OPACITY = 0.3;

function main() {
    console.log('VGG Image Annotator (via)');    

    // hide canvas and show starting information
    image_canvas.style.display = "none";
    starting_information_panel.style.display = "block";
    help_panel.style.display = "none";
    via_session_data_panel.style.display = "none";

    // initialize local storage
    if ( check_local_storage ) {
	is_local_storage_available = true;

	if ( localStorage.getItem('image_annotation_list') ) {
	    load_image_annotation_from_localstorage();

	    populate_image_annotation_list_snippet();
	    image_canvas.style.display = "none";
	    starting_information_panel.style.display = "none";
	    help_panel.style.display = "none";
	    via_session_data_panel.style.display = "block";
	}

	show_status("VGG Image Annotator (via) version " + VIA_VERSION + ". Ready !");
    } else {
	is_local_storage_available = false;
	show_info("Warning: your browser does not allow local storage. Remember to save your work before exiting.");
    }
    show_info("");
}

function populate_image_annotation_list_snippet() {
    var table_str = "<table style='margin:auto; padding: 1em; line-height:1.5em; text-align: left;'><tr><th>Filename</th><th>description</th><th>annotations</th></tr>";
    var entry_count = 0;
    for ( var image_id in image_annotation_list ) {
	var filename = image_annotation_list[image_id].filename;
	var file_description = image_annotation_list[image_id].description;
	var file_annotations = "";
	for ( var ri=0; ri<image_annotation_list[image_id].image_region_list.length; ++ri) {
	    file_annotations += image_annotation_list[image_id].image_region_list[ri].description + ", ";
	}
	file_annotations = file_annotations.substring(0, file_annotations.length - 2); // remove last comma
	
	table_str += "<tr><td>" + filename + "</td>";
	table_str += "<td>" + file_description + "</td>";
	table_str += "<td>" + file_annotations + "</td></tr>";

	if ( entry_count >= 1 ) {
	    table_str += "<tr><td>...</td>";
	    table_str += "<td>...</td>";
	    table_str += "<td>...</td></tr>";

	    break;
	}
	entry_count = entry_count + 1;
    }
    table_str += "</table>";
    image_annotation_list_snippet.innerHTML = table_str;
}


function load_image_annotation_from_localstorage() {
    console.log(localStorage.getItem("image_annotation_list"));
    var robj = JSON.parse(localStorage.getItem("image_annotation_list"));
    console.log(robj);    
    for ( var image_id in robj ) {
	var image_annotation = new ImageAnnotation(robj[image_id].filename,
						   robj[image_id].size,
						   robj[image_id].description);
	for ( var ri=0; ri<robj[image_id].image_region_list.length; ++ri) {
	    var region = new ImageRegion(robj[image_id].image_region_list[ri].x0,
					 robj[image_id].image_region_list[ri].y0,
					 robj[image_id].image_region_list[ri].x1,
					 robj[image_id].image_region_list[ri].y1,
					 robj[image_id].image_region_list[ri].description);
	    image_annotation.image_region_list.push(region);
	    console.log(region);
	}
	image_annotation_list[image_id] = image_annotation;
	console.log(image_annotation_list);
    }
}

function save_image_annotation_data(type) {
    var image_annotation_list_str = get_image_annotation_list(type);
    console.log(image_annotation_list_str);
    var image_annotation_list_blob = new Blob([image_annotation_list_str], {type: 'text/'+type+';charset=utf-8'});
    
    save_data_to_local_file(image_annotation_list_blob, 'annotations.'+type);
    console.log(image_annotation_list_str);
}

function discard_via_session_data() {
    localStorage.clear();
    show_info("Cleared annotations from previous session");
    
    image_canvas.style.display = "none";
    starting_information_panel.style.display = "block";
    help_panel.style.display = "none";
    via_session_data_panel.style.display = "none";
}

function get_image_annotation_list(type) {
    console.log(image_annotation_list);
    if( type == "csv" ) {
	csv_str = "#filename,size,file_description,x0,y0,x1,y1,region_description";

	for ( var image_id in image_annotation_list ) {
	    var image_annotation = image_annotation_list[image_id];
	    var prefix_str = image_annotation.filename;
	    prefix_str += "," + image_annotation.size;
	    prefix_str += "," + image_annotation.description;

	    var region_count = image_annotation.image_region_list.length;
	    for ( var i=0; i<region_count; ++i) {
		var region_str = "\n" + prefix_str + "," + i;
		region_str += "," + image_annotation.image_region_list[i].x0;
		region_str += "," + image_annotation.image_region_list[i].y0;
		region_str += "," + image_annotation.image_region_list[i].x1;
		region_str += "," + image_annotation.image_region_list[i].y1;
		region_str += "," + image_annotation.image_region_list[i].description;
		csv_str += region_str;
	    }
	}
	return csv_str;
    } else {
	return JSON.stringify(image_annotation_list);
    }    
}

function save_data_to_local_file(data, filename) {
    console.log(data);
    var a = document.createElement('a');
    a.href = URL.createObjectURL(data);
    a.target = '_blank';
    a.download = filename;

    // simulate a mouse click event
    var event = new MouseEvent('click', {
        view: window,
        bubbles: true,
        cancelable: true
    });
    
    a.dispatchEvent(event);

}

function update_ui_components() {
    if ( !is_window_resized && current_image_loaded ) {
        show_status("Resizing window ...", false);
        is_window_resized = true;
        load_local_file(current_image_index);
    }
}

home_button.addEventListener("click", function(e) {
    if (current_image_loaded) {
        image_canvas.style.display = "inline";
        starting_information_panel.style.display = "none";
        redraw_image_canvas();

	show_navigation_info("(" + (current_image_index+1) + "/" +
			     user_uploaded_images.length + ") " +
			     current_image_filename);
	show_annotation_info("[" + bounding_box_count + "] boxes and [" +
			     annotation_count + "] annotations");
	show_status("Press <span style='color:red;'>Enter</span> key to annotate," +
                    " <span style='color:red'>Arrow keys</span> to move to next image.");
    } else {
        image_canvas.style.display = "none";
        starting_information_panel.style.display = "block";

        status_prefix = "";
	
	show_navigation_info("");
	show_annotation_info("");
	show_status("VGG Image Annotator (via) version " + VIA_VERSION + ". Ready !");
    }

    help_panel.style.display = "none";
    via_session_data_panel.style.display = "none";
    
}, false);

load_images_button.addEventListener("click", function(e) {
    // source: https://developer.mozilla.org/en-US/docs/Using_files_from_web_applications
    if (invisible_file_input) {
        invisible_file_input.click();
        
        image_canvas.style.display = "inline";
        starting_information_panel.style.display = "none";
        help_panel.style.display = "none";
	via_session_data_panel.style.display = "none";
    }
    e.preventDefault(); // prevent navigation to "#"
}, false);

json_download_link.addEventListener('click', function(e) {
    if ( image_filename_list.length > 0 ) {
        var json_str = [];
        for ( var i=0; i<image_filename_list.length; ++i) {
            var filename = image_filename_list[i];

            // convert all coordinates to integer
            var int_x0 = x0[filename].slice(); var int_y0 = y0[filename].slice();
            var int_x1 = x1[filename].slice(); var int_y1 = y1[filename].slice();
            for (var j=0; j<int_x0.length; ++j) {
                int_x0[j] = Math.round(int_x0[j]);
                int_y0[j] = Math.round(int_y0[j]);
                int_x1[j] = Math.round(int_x1[j]);
                int_y1[j] = Math.round(int_y1[j]);
            }
            
            // only write non-empty bounding boxes
            if ( x0[filename].length > 0 ) {    
                var img_annotation_json = {"filename":filename,
                                           "x0":int_x0,
                                           "y0":int_y0,
                                           "x1":int_x1,
                                           "y1":int_y1,
                                           "annotations":annotations[filename]};
                json_str.push( JSON.stringify(img_annotation_json) );
            }
        }
        var json_file = new Blob(json_str, {type: "text/plain;charset=utf-8"});
        json_download_link.href = URL.createObjectURL(json_file);
        json_download_link.name = "annotations.json";
        json_download_link.title = "annotations.json";
        json_download_link.target = "_new";
    } else {
        show_status("Please do some annotations first.", false);
    }
});

delete_annotations_button.addEventListener("click", function(e) {
    if ( bounding_box_count > 0 || annotation_count > 0 ) {
        bounding_box_count = 0;
        annotation_count = 0;
        x0[current_image_filename] = []; y0[current_image_filename] = [];
        x1[current_image_filename] = []; y1[current_image_filename] = [];
        canvas_x0[current_image_filename] = []; canvas_y0[current_image_filename] = [];
        canvas_x1[current_image_filename] = []; canvas_y1[current_image_filename] = [];

        annotations[current_image_filename] = [];
        current_annotation_bounding_box_id = -1;

        show_status("All bounding boxes deleted! I hope this was not a mistake :-)", false);
        redraw_image_canvas();
    } else {
        show_status("Bounding boxes are not present!", false);
    }
}, false);

help_button.addEventListener("click", function(e) {
    image_canvas.style.display = "none";
    starting_information_panel.style.display = "none";
    help_panel.style.display = "block";
}, false);

// enter annotation mode on double click
image_canvas.addEventListener('dblclick', function(e) {
    click_x1 = e.offsetX; click_y1 = e.offsetY;

    var bounding_box_id = is_inside_bounding_box(click_x1, click_y1);
    if ( bounding_box_id >= 0 ) {
	current_selected_bounding_box_index = -1;
	user_entering_annotation = true;
	current_annotation_bounding_box_id = bounding_box_id;
	annotate_bounding_box(current_annotation_bounding_box_id);

	show_status("Please enter annotation");
    }

}, false);

image_canvas.addEventListener('mousedown', function(e) {
    click_x0 = e.offsetX; click_y0 = e.offsetY;

    if ( current_selected_bounding_box_index >= 0 ) {
	bounding_box_edge = is_on_bounding_box_corner(click_x0, click_y0, bounding_box_edge_tol);
	
	if ( bounding_box_edge[1] > 0 &&
	     !is_user_resizing_bounding_box ) {
	    if ( bounding_box_edge[0] == current_selected_bounding_box_index ) {
		is_user_resizing_bounding_box = true;
	    } else {
		current_selected_bounding_box_index = bounding_box_edge[0];
	    }
	} else {
	    var bounding_box_id = is_inside_bounding_box(click_x0, click_y0);
	    if ( bounding_box_id >=0 &&
	         !bounding_box_being_moved ) {
		if( bounding_box_id == current_selected_bounding_box_index ) {
		    bounding_box_being_moved = true;
		    box_click_x = click_x0;
		    box_click_y = click_y0;
		} else {
		    current_selected_bounding_box_index = bounding_box_id;
		    bounding_box_being_moved = true;
		    box_click_x = click_x0;
		    box_click_y = click_y0;
		}
	    }
	}
    } else {
	// this is a bounding box drawing event
	is_user_resizing_bounding_box = false;
	bounding_box_being_moved = false;
	user_drawing_bounding_box = true;
	current_selected_bounding_box_index = -1;	
    }
    e.preventDefault();
}, false);

image_canvas.addEventListener('mouseup', function(e) {
    click_x1 = e.offsetX; click_y1 = e.offsetY;

    var dx = Math.abs(click_x1 - click_x0);
    var dy = Math.abs(click_y1 - click_y0);
    
    if ( dx < 5 || dy < 5 ) {
        user_drawing_bounding_box = false;
        var bounding_box_id = is_inside_bounding_box(click_x0, click_y0);
        if ( bounding_box_id >= 0 ) {
	    // first click selects the bounding box for further action
	    current_selected_bounding_box_index = bounding_box_id;
	    user_entering_annotation = false;
	    redraw_image_canvas();
	    show_status("<span style='color:red;'>Del</span> to delete and <span style='color:red;'>Mouse over</span> to update");

	    // show full annotations
	    var bbox_annotation_str = annotations[current_image_filename][current_selected_bounding_box_index];
	    show_info( parse_annotation_str(bbox_annotation_str) );
        } else {
	    // click on other non-boxed area
	    if ( user_entering_annotation ) {
                annotation_textbox.style.visibility = "hidden";
                current_annotation_bounding_box_id = -1;
                user_entering_annotation = false;
	    }
	    if ( current_selected_bounding_box_index != -1 ) {
		// clear all bounding box selection
		current_selected_bounding_box_index = -1;		
	    }
	    redraw_image_canvas();
	    show_status("Press <span style='color:red;'>Enter</span> key to annotate," +
                        " <span style='color:red'>Arrow keys</span> to move to next image.");
	    
	    var annotation_attributes_str = "";
	    for ( let attributes of annotation_attributes ) {
		annotation_attributes_str += "<span style='color:" + COLOR_KEY + ";'>" + attributes + "</span> ,";
	    }
	    // remove last comma
	    annotation_attributes_str = annotation_attributes_str.substring(0, annotation_attributes_str.length-1);
	    show_info( "Attributes : [ " + annotation_attributes_str + " ]" );
        }
    }
    if ( bounding_box_being_moved ) {
	bounding_box_being_moved = false;
	image_canvas.style.cursor = "default";

	var move_x = (box_click_x - click_x1);
	var move_y = (box_click_y - click_y1);

	canvas_x0[current_image_filename][current_selected_bounding_box_index] -= move_x;
	canvas_y0[current_image_filename][current_selected_bounding_box_index] -= move_y;
	canvas_x1[current_image_filename][current_selected_bounding_box_index] -= move_x;
	canvas_y1[current_image_filename][current_selected_bounding_box_index] -= move_y;

	x0[current_image_filename][current_selected_bounding_box_index] -= move_x*scale_factor[current_image_filename];
	y0[current_image_filename][current_selected_bounding_box_index] -= move_y*scale_factor[current_image_filename];
	x1[current_image_filename][current_selected_bounding_box_index] -= move_x*scale_factor[current_image_filename];
	y1[current_image_filename][current_selected_bounding_box_index] -= move_y*scale_factor[current_image_filename];
	
	redraw_image_canvas();
    }

    // this was a bounding box drawing event
    if ( is_user_resizing_bounding_box ) {
	is_user_resizing_bounding_box = false;
	image_canvas.style.cursor = "default";
	
	// update the bounding box
	var box_id = bounding_box_edge[0];
	var new_x0, new_y0, new_x1, new_y1;
	
	switch(bounding_box_edge[1]) {
	case 1: // top-left
	    canvas_x0[current_image_filename][box_id] = click_x1;
	    x0[current_image_filename][box_id] = click_x1 * scale_factor[current_image_filename];
	    canvas_y0[current_image_filename][box_id] = click_y1;
	    y0[current_image_filename][box_id] = click_y1 * scale_factor[current_image_filename];
	    break;
	case 3: // bottom-right
	    canvas_x1[current_image_filename][box_id] = click_x1;
	    x1[current_image_filename][box_id] = click_x1 * scale_factor[current_image_filename];
	    canvas_y1[current_image_filename][box_id] = click_y1;
	    y1[current_image_filename][box_id] = click_y1 * scale_factor[current_image_filename];		
	    break;
	case 2: // top-right
	    canvas_y0[current_image_filename][box_id] = click_y1;
	    y0[current_image_filename][box_id] = click_y1 * scale_factor[current_image_filename];
	    canvas_x1[current_image_filename][box_id] = click_x1;
	    x1[current_image_filename][box_id] = click_x1 * scale_factor[current_image_filename];
	    break;
	case 4: // bottom-left
	    canvas_x0[current_image_filename][box_id] = click_x1;
	    x0[current_image_filename][box_id] = click_x1 * scale_factor[current_image_filename];
	    canvas_y1[current_image_filename][box_id] = click_y1;
	    y1[current_image_filename][box_id] = click_y1 * scale_factor[current_image_filename];
	    break;
	}
	redraw_image_canvas();
    }

    if (user_drawing_bounding_box) {
	var regx0, regy0, regx1, regy1;
	// ensure that (x0,y0) is top-left and (x1,y1) is bottom-right
        if ( click_x0 < click_x1 ) {
	    regx0 = click_x0 * scale_factor[current_image_filename];
	    regx1 = click_x1 * scale_factor[current_image_filename];
	    
            x0[current_image_filename].push(click_x0 * scale_factor[current_image_filename]);
            x1[current_image_filename].push(click_x1 * scale_factor[current_image_filename]);
	    canvas_x0[current_image_filename].push(click_x0);
	    canvas_x1[current_image_filename].push(click_x1);		
        } else {
	    regx0 = click_x1 * scale_factor[current_image_filename];
	    regx1 = click_x0 * scale_factor[current_image_filename];
	    
	    x0[current_image_filename].push(click_x1 * scale_factor[current_image_filename]);
            x1[current_image_filename].push(click_x0 * scale_factor[current_image_filename]);
	    canvas_x0[current_image_filename].push(click_x1);
	    canvas_x1[current_image_filename].push(click_x0);
	}

	if ( click_y0 < click_y1 ) {
	    regy0 = click_y0 * scale_factor[current_image_filename];
	    regy1 = click_y1 * scale_factor[current_image_filename];
	    
            y0[current_image_filename].push(click_y0 * scale_factor[current_image_filename]);
            y1[current_image_filename].push(click_y1 * scale_factor[current_image_filename]);
            canvas_y0[current_image_filename].push(click_y0);
            canvas_y1[current_image_filename].push(click_y1);
	} else {
	    regy0 = click_y1 * scale_factor[current_image_filename];
	    regy1 = click_y0 * scale_factor[current_image_filename];

            y0[current_image_filename].push(click_y1 * scale_factor[current_image_filename]);
            y1[current_image_filename].push(click_y0 * scale_factor[current_image_filename]);
            canvas_y0[current_image_filename].push(click_y1);
            canvas_y1[current_image_filename].push(click_y0);
	}

	add_image_region(current_image_id,
			 regx0, regy0,
			 regx1, regy1);
	
        bounding_box_count = bounding_box_count + 1;
        annotations[current_image_filename].push("");

	show_annotation_info("[" + bounding_box_count + "] boxes and [" +
			     annotation_count + "] annotations");
        user_drawing_bounding_box = false;
        redraw_image_canvas();
    }
    
});

image_canvas.addEventListener("mouseover", function(e) {
    redraw_image_canvas();
});

image_canvas.addEventListener('mousemove', function(e) {
    if ( !current_image_loaded ) {
	return;
    }
    
    current_x = e.offsetX; current_y = e.offsetY;

    if ( current_selected_bounding_box_index >= 0) {
	if ( !is_user_resizing_bounding_box ) {
	    bounding_box_edge = is_on_bounding_box_corner(current_x, current_y, bounding_box_edge_tol);   
	    
	    if ( bounding_box_edge[0] == current_selected_bounding_box_index ) {
		switch(bounding_box_edge[1]) {
		case 1: // top-left
		case 3: // bottom-right
		    image_canvas.style.cursor = "nwse-resize";
		    break;
		case 2: // top-right
		case 4: // bottom-left		
		    image_canvas.style.cursor = "nesw-resize";
		    break;
		default:
		    image_canvas.style.cursor = "default";
		}
	    } else {
		// a bounding box has been selected
		var bounding_box_id = is_inside_bounding_box(current_x, current_y);
		if ( bounding_box_id == current_selected_bounding_box_index ) {
		    image_canvas.style.cursor = "move";
		} else {
		    image_canvas.style.cursor = "default";
		}
	    }
	}
    }
    
    if(user_drawing_bounding_box) {
        // draw rectangle as the user drags the mouse cousor
        redraw_image_canvas(); // clear old intermediate rectangle

        var w = Math.abs(current_x - click_x0);
        var h = Math.abs(current_y - click_y0);
        var top_left_x, top_left_y;

        if ( click_x0 < current_x ) {
            if ( click_y0 < current_y ) {
                top_left_x = click_x0;
                top_left_y = click_y0;
            } else {
                top_left_x = click_x0;
                top_left_y = current_y;
            }
        } else {
            if ( click_y0 < current_y ) {
                top_left_x = current_x;
                top_left_y = click_y0;
            } else {
                top_left_x = current_x;
                top_left_y = current_y;
            }
        }

	draw_bounding_box(top_left_x, top_left_y, w, h,
			  BBOX_BOUNDARY_FILL_COLOR_NEW);
        image_canvas.focus();
    }
    
    if ( is_user_resizing_bounding_box ) {
	// user has clicked mouse on bounding box edge and is now moving it
        redraw_image_canvas(); // clear old intermediate rectangle

        var top_left_x, top_left_y, w, h;
	var sel_box_id = bounding_box_edge[0];
	switch(bounding_box_edge[1]) {
	case 1: // top-left
	    top_left_x = current_x;
	    top_left_y = current_y;
	    w = Math.abs(current_x - canvas_x1[current_image_filename][sel_box_id]);
	    h = Math.abs(current_y - canvas_y1[current_image_filename][sel_box_id]);
	    break;
	case 3: // bottom-right
	    top_left_x = canvas_x0[current_image_filename][sel_box_id];
	    top_left_y = canvas_y0[current_image_filename][sel_box_id];
	    w = Math.abs(top_left_x - current_x);
	    h = Math.abs(top_left_y - current_y);
	    break;
	case 2: // top-right
	    top_left_x = canvas_x0[current_image_filename][sel_box_id];
	    top_left_y = current_y;
	    w = Math.abs(top_left_x - current_x);
	    h = Math.abs(canvas_y1[current_image_filename][sel_box_id] - current_y);
	    break;
	case 4: // bottom-left
	    top_left_x = current_x;
	    top_left_y = canvas_y0[current_image_filename][sel_box_id];
	    w = Math.abs(canvas_x1[current_image_filename][sel_box_id] - current_x);
	    h = Math.abs(current_y - canvas_y0[current_image_filename][sel_box_id]);
	    break;
	}
	draw_bounding_box(top_left_x, top_left_y, w, h,
			  BBOX_BOUNDARY_FILL_COLOR_NEW);
        image_canvas.focus();
    }

    if ( bounding_box_being_moved ) {
	redraw_image_canvas();
	var move_x = (box_click_x - current_x);
	var move_y = (box_click_y - current_y);

	var moved_x0 = canvas_x0[current_image_filename][current_selected_bounding_box_index] - move_x;
	var moved_y0 = canvas_y0[current_image_filename][current_selected_bounding_box_index] - move_y;
	var moved_x1 = canvas_x1[current_image_filename][current_selected_bounding_box_index] - move_x;
	var moved_y1 = canvas_y1[current_image_filename][current_selected_bounding_box_index] - move_y;

	draw_bounding_box(moved_x0, moved_y0,
			  Math.abs(moved_x1 - moved_x0),
			  Math.abs(moved_y1 - moved_y0),
			  BBOX_BOUNDARY_FILL_COLOR_NEW);
        image_canvas.focus();	
    }
    
    if ( zoom_active &&
	 !bounding_box_being_moved &&
	 !is_user_resizing_bounding_box ) {

	var sf = scale_factor[current_image_filename];
	var original_image_x = current_x * sf;
	var original_image_y = current_y * sf;

	//console.log("zoom_size_pixel=" + zoom_size_pixel + ", sf=" + sf);
	//console.log("original_image_x=" + original_image_x + ", original_image_y=" + original_image_y);
	
	redraw_image_canvas();
	image_context.drawImage(current_image,
				original_image_x - 100,
				original_image_y - 100,
				2*100,
				2*100,
				current_x - 200,
				current_y - 200,
				2*200,
				2*200
			       );
	
	draw_bounding_box(current_x - 200,
			  current_y - 200,
			  2*200,
			  2*200,
			  ZOOM_BOUNDARY_COLOR);
    }
    
    //console.log("user_drawing_bounding_box=" + user_drawing_bounding_box + ", is_user_resizing_bounding_box=" + is_user_resizing_bounding_box + ", bounding_box_edge=" + bounding_box_edge[0] + "," + bounding_box_edge[1]);
    
    /* @todo: implement settings -> show guide
       else {
       redraw_image_canvas();
       current_x = e.offsetX; current_y = e.offsetY;
       image_context.strokeStyle="#ffffff";
       image_context.setLineDash([0]);
       image_context.strokeRect(0, current_y, canvas_width, 1);
       image_context.strokeRect(current_x, 0, 1, canvas_height);
       image_canvas.focus();
       }
    */
});

function draw_all_bounding_box() {
    annotation_count = 0;
    image_context.shadowBlur = 0;
    var bbox_boundary_fill_color = "";
    for (var i=0; i<bounding_box_count; ++i) {
        if ( annotations[current_image_filename][i] == "" ) {
	    bbox_boundary_fill_color = BBOX_BOUNDARY_FILL_COLOR_NEW;
        } else {
	    bbox_boundary_fill_color = BBOX_BOUNDARY_FILL_COLOR_ANNOTATED;
	    annotation_count = annotation_count + 1;
        }
	
	draw_bounding_box(canvas_x0[current_image_filename][i],
			  canvas_y0[current_image_filename][i],
			  canvas_x1[current_image_filename][i] - canvas_x0[current_image_filename][i],
			  canvas_y1[current_image_filename][i] - canvas_y0[current_image_filename][i],
			  bbox_boundary_fill_color);
	
	if ( current_selected_bounding_box_index == i ) {
	    image_context.fillStyle=BBOX_SELECTED_FILL_COLOR;
	    image_context.globalAlpha = BBOX_SELECTED_OPACITY;
	    image_context.fillRect(canvas_x0[current_image_filename][i] + BBOX_LINE_WIDTH/2,
                                   canvas_y0[current_image_filename][i] + BBOX_LINE_WIDTH/2,
                                   canvas_x1[current_image_filename][i] - canvas_x0[current_image_filename][i] - BBOX_LINE_WIDTH,
                                   canvas_y1[current_image_filename][i] - canvas_y0[current_image_filename][i] - BBOX_LINE_WIDTH);
	    image_context.globalAlpha = 1.0;
	}
    }
}

function draw_bounding_box(x0, y0, w, h, boundary_fill_color) {
    image_context.strokeStyle = boundary_fill_color;
    image_context.lineWidth = BBOX_LINE_WIDTH/2;    
    image_context.strokeRect(x0 - BBOX_LINE_WIDTH/4,
                             y0 - BBOX_LINE_WIDTH/4,
                             w + BBOX_LINE_WIDTH/4,
                             h + BBOX_LINE_WIDTH/4);
    image_context.lineWidth = BBOX_LINE_WIDTH/4;
    image_context.strokeStyle = BBOX_BOUNDARY_LINE_COLOR;
    image_context.strokeRect(x0 - BBOX_LINE_WIDTH/2 - 0.5,
                             y0 - BBOX_LINE_WIDTH/2 - 0.5,
                             w + BBOX_LINE_WIDTH,
                             h + BBOX_LINE_WIDTH);
    image_context.strokeRect(x0 + BBOX_LINE_WIDTH/4 - 0.5,
                             y0 + BBOX_LINE_WIDTH/4 - 0.5,
                             w - BBOX_LINE_WIDTH/2,
                             h - BBOX_LINE_WIDTH/2);
}

function draw_all_annotations() {
    image_context.shadowColor = "transparent";
    for (var i=0; i<bounding_box_count; ++i) {
        if ( annotations[current_image_filename][i] != "" ) {
            var w = Math.abs(canvas_x1[current_image_filename][i] - canvas_x0[current_image_filename][i]);
            image_context.font = '12pt Sans';

            var bgnd_rect_height = 1.8 * image_context.measureText('M').width;
            var bgnd_rect_width = image_context.measureText(annotations[current_image_filename][i]).width;
	    var bbox_width = Math.abs( canvas_x1[current_image_filename][i] - canvas_x0[current_image_filename][i] );

	    var annotation_str = annotations[current_image_filename][i];
	    if ( bgnd_rect_width > bbox_width ) {
		var max_str_len = Math.round(annotation_str.length * (bbox_width/bgnd_rect_width)) - 4;
		annotation_str = annotation_str.substring(0, max_str_len) + '...';
		bgnd_rect_width = bbox_width;
	    } else {
		bgnd_rect_width = bgnd_rect_width + 0.6*bgnd_rect_height;
	    }
            
            // first, draw a background rectangle first
            image_context.fillStyle = 'black';
            image_context.globalAlpha=0.5;          
            image_context.fillRect(canvas_x0[current_image_filename][i],
                                   canvas_y0[current_image_filename][i] - bgnd_rect_height,
                                   bgnd_rect_width,
                                   bgnd_rect_height);
            // then, draw text over this background rectangle
            image_context.globalAlpha=1.0;
            image_context.fillStyle = 'yellow';
            image_context.fillText(annotation_str,
                                   canvas_x0[current_image_filename][i] + bgnd_rect_height/4,
                                   canvas_y0[current_image_filename][i] - bgnd_rect_height/3);
        }
    }
}

function redraw_image_canvas() {
    if (current_image_loaded) {
        image_context.drawImage(current_image, 0, 0, canvas_width, canvas_height);
        draw_all_bounding_box();
        draw_all_annotations();
    }
}

function load_local_file(file_id) {
    current_image_index = file_id;
    current_image_id = image_id_list[file_id];
    var img_file = user_uploaded_images[current_image_index];

    if (!img_file) {
        return;
    } else {       
        current_image_filename = image_filename_list[current_image_index];
        img_reader = new FileReader();

        img_reader.addEventListener( "progress", function(e) {
            show_status("Loading image " + current_image_filename + " ... ", false);
        }, false);

        img_reader.addEventListener( "error", function() {
            show_status("Error loading image " + current_image_filename + " !", false);
        }, false);
        
        img_reader.addEventListener( "load", function() {
            current_image = new Image();
            current_image.addEventListener( "load", function() {
                // retrive image panel dim. to stretch image_canvas to fit panel
                main_content_width = main_content.offsetWidth;
                //main_content_height = main_content.offsetHeight;
		main_content_height = container.offsetHeight*0.8;
                
                canvas_width = current_image.naturalWidth;
                canvas_height = current_image.naturalHeight;

                var scale_width, scale_height;
                if ( canvas_width > main_content_width ) {
                    // resize image to match the panel width
                    scale_width = main_content_width / current_image.naturalWidth;
                    canvas_width = main_content_width;
                    canvas_height = current_image.naturalHeight * scale_width;
                }
                // resize image if its height is larger than the image panel
                if ( canvas_height > main_content_height ) {
                    scale_height = main_content_height / canvas_height;
                    canvas_height = main_content_height;
                    canvas_width = canvas_width * scale_height;
                }

                canvas_width = Math.round(canvas_width);
                canvas_height = Math.round(canvas_height);
                
                scale_factor[current_image_filename] = current_image.naturalWidth / canvas_width;
                
                // set the canvas size to match that of the image
                image_canvas.height = canvas_height;
                image_canvas.width = canvas_width;

		zoom_size_pixel = Math.round(ZOOM_SIZE_PERCENT * Math.min(canvas_width, canvas_height));

                current_image_loaded = true;
                bounding_box_count = x0[current_image_filename].length;
                annotation_count = 0;
                for ( var i=0; i<annotations[current_image_filename].length; ++i) {
                    if ( annotations[current_image_filename][i] != "" ) {
                        annotation_count = annotation_count + 1;
                    }
                }
                
                click_x0 = 0; click_y0 = 0;
                click_x1 = 0; click_y1 = 0;
                user_drawing_bounding_box = false;
                user_entering_annotation = false;
                is_window_resized = false;

                if ( bounding_box_count > 0 ) {
                    // update the canvas image space coordinates
                    var fn = current_image_filename;
                    for ( var j=0; j<x0[current_image_filename].length; ++j ) {
                        canvas_x0[fn][j] = x0[fn][j] / scale_factor[fn];
                        canvas_y0[fn][j] = y0[fn][j] / scale_factor[fn];
                        canvas_x1[fn][j] = x1[fn][j] / scale_factor[fn];
                        canvas_y1[fn][j] = y1[fn][j] / scale_factor[fn];
                    }

                    redraw_image_canvas();
                } else {
                    image_context.drawImage(current_image, 0, 0, canvas_width, canvas_height);
                }

                image_canvas.style.display = "inline";
                starting_information_panel.style.display = "none";
                help_panel.style.display = "none";

		show_navigation_info("(" + (current_image_index+1) + "/" +
				     user_uploaded_images.length + ") " +
				     current_image_filename);
		show_annotation_info("[" + bounding_box_count + "] boxes and [" +
				     annotation_count + "] annotations");
		show_status("Press <span style='color:red;'>Enter</span> key to annotate," +
                            " <span style='color:red'>Arrow keys</span> to move to next image.");

            });
            current_image.src = img_reader.result;
        }, false);
        img_reader.readAsDataURL(img_file);
    }
}

function upload_local_files(user_selected_files) {
    user_uploaded_images = user_selected_files;
    for ( var i=0; i<user_uploaded_images.length; ++i) {
        var filename = user_uploaded_images[i].name;
	var size = user_uploaded_images[i].size;
        x0[filename] = []; y0[filename] = [];
        x1[filename] = []; y1[filename] = [];
        canvas_x0[filename] = []; canvas_y0[filename] = [];
        canvas_x1[filename] = []; canvas_y1[filename] = [];
        annotations[filename] = [];
        image_filename_list[i] = filename;
        scale_factor[filename] = 1.0;

	var image_id = init_image_annotation(filename, size);
	image_id_list[i] = image_id;
    }
    
    if ( user_uploaded_images.length > 0 ) {
        load_local_file(0);
    } else {
        show_status("Please upload some files!", false);
    }
}

function is_inside_bounding_box(x, y) {
    for (var i=0; i<bounding_box_count; ++i) {
        if ( x > canvas_x0[current_image_filename][i] &&
             x < canvas_x1[current_image_filename][i] &&
             y > canvas_y0[current_image_filename][i] &&
             y < canvas_y1[current_image_filename][i] ) {
            return i;
        }
    }    
    return -1;
}

function is_on_bounding_box_corner(x, y, tolerance) {
    var cx0, cy0, cx1, cy1;
    var bounding_box_edge = [-1, -1]; // bounding_box_id, corner_id [top-left=1,top-right=2,bottom-right=3,bottom-left=4]
    
    for (var i=0; i<bounding_box_count; ++i) {
	dx0 = Math.abs( canvas_x0[current_image_filename][i] - x );
	dy0 = Math.abs( canvas_y0[current_image_filename][i] - y );
	dx1 = Math.abs( canvas_x1[current_image_filename][i] - x );
	dy1 = Math.abs( canvas_y1[current_image_filename][i] - y );
	
	bounding_box_edge[0] = i;
        if ( dx0 < tolerance && dy0 < tolerance ) {
	    bounding_box_edge[1] = 1;
	    return bounding_box_edge;
	} else {
	    if ( dx1 < tolerance && dy0 < tolerance ) {
		bounding_box_edge[1] = 2;
		return bounding_box_edge;
	    } else {
		if ( dx1 < tolerance && dy1 < tolerance ) {
		    bounding_box_edge[1] = 3;
		    return bounding_box_edge;
		} else {
		    if ( dx0 < tolerance && dy1 < tolerance ) {
			bounding_box_edge[1] = 4;
			return bounding_box_edge;
		    }
		}
	    }
	}
    }
    bounding_box_edge[0] = -1;
    return bounding_box_edge;
}

function annotate_bounding_box(bounding_box_id) {
    var w = x1[current_image_filename][bounding_box_id] - x0[current_image_filename][bounding_box_id];
    var canvas_origin_x0 = image_canvas.getBoundingClientRect().left;
    var canvas_origin_y0 = image_canvas.getBoundingClientRect().top;
    var annotation_textbox_y = canvas_origin_y0 + canvas_y0[current_image_filename][bounding_box_id];
    var annotation_textbox_x = canvas_origin_x0 + canvas_x0[current_image_filename][bounding_box_id];

    annotation_textbox.style.position = "fixed";
    annotation_textbox.style.top = annotation_textbox_y.toString() + "px";
    annotation_textbox.style.left = annotation_textbox_x.toString() + "px";
    annotation_textbox.style.opacity = 0.5;
    annotation_textbox.value = annotations[current_image_filename][bounding_box_id];
    annotation_textbox.style.visibility = "visible";

    if ( w > (canvas_width/2) ) {
	annotation_textbox.style.width = (canvas_width/2).toString() + "px";
    } else {
	annotation_textbox.style.width = (w - w/4).toString() + "px";
    }
    annotation_textbox.style.height = "1.5em";
    annotation_textbox.focus();

    if ( annotation_attributes.size > 0 ) {
	var help_str1 = "";
	var help_str2 = "";
	var value_count = 1;
	for ( let attributes of annotation_attributes ) {
	    help_str1 += "<span style='color:" + COLOR_KEY + ";'>" + attributes + "</span>=" +
		"<span style='color:" + COLOR_VALUE + ";'>value" + value_count + "; ";
	    help_str2 += "<span style='color:" + COLOR_VALUE + ";'>value" + value_count + "; ";
	    value_count = value_count + 1;
	}
	show_info("Enter value of the attributes as follows | " + help_str1 + " | " + help_str2);
    } else {
	show_info("Enter value of the attributes as follows | key1=value1;key2=value2; ..." + " | value1;value2;..." );
    }
}

window.addEventListener("keydown", function(e) {
    if ( e.which == 13 ) { // Enter
        // when user presses Enter key, enter bounding box annotation mode
        if ( !user_entering_annotation && bounding_box_count > 0 ) {
            current_annotation_bounding_box_id = -1;

    	    if ( current_selected_bounding_box_index != -1 ) {
		current_annotation_bounding_box_id = current_selected_bounding_box_index;
		user_entering_annotation = true;		    		
		annotate_bounding_box(current_annotation_bounding_box_id);		
	    } else {
		// find the un-annotated bounding box
		for ( var i=0; i<annotations[current_image_filename].length; ++i) {
                    if ( annotations[current_image_filename][i] == "" ) {
			current_annotation_bounding_box_id = i;
			break;
                    }
		}

		if ( current_annotation_bounding_box_id != -1 ) {
		    // enter annotation mode only if an un annotated box is present
		    user_entering_annotation = true;		    
		    annotate_bounding_box(current_annotation_bounding_box_id);
		}
	    }

        } else {
            if ( user_entering_annotation && bounding_box_count > 0 ) {
                // Enter key pressed after user updates annotations in textbox
		// update annotation_attributes
		var m = str2map(annotation_textbox.value);
		console.log(m);
		var annotation_parsed_str = "";
		if ( m.size != 0 ) {
		    // updates keys and ensure consistency of existing keys
		    for ( var [key, value] of m ) {
			if ( ! annotation_attributes.has(key) ) {
			    annotation_attributes.add(key);
			}
			annotation_parsed_str = annotation_parsed_str + key + "=" + value + ";"
		    }
		} else {
		    annotation_parsed_str = annotation_textbox.value;
		}
		annotations[current_image_filename][current_annotation_bounding_box_id] = annotation_parsed_str;
		add_image_region_description(current_image_id, current_annotation_bounding_box_id, annotation_parsed_str);
		console.log("annotation_parsed_str=" + annotation_parsed_str);
		show_info("");
		
		// update the list of attributes
                annotation_textbox.value = "";
                annotation_textbox.style.visibility = "hidden";
                redraw_image_canvas();

		// find a unannotated bounding box to next move to
		current_annotation_bounding_box_id = -1;
		for ( var i=0; i<annotations[current_image_filename].length; ++i) {
		    if ( annotations[current_image_filename][i] == "" ) {
			current_annotation_bounding_box_id = i;
			break;
		    }
		}

		if ( current_annotation_bounding_box_id != -1 ) {
                    user_entering_annotation = true;
                    annotate_bounding_box(current_annotation_bounding_box_id);
                } else {
                    // exit bounding box annotation mode
                    current_annotation_bounding_box_id = -1;		    
                    user_entering_annotation = false;
                    annotation_textbox.style.visibility = "hidden";
                }

		show_navigation_info("(" + (current_image_index+1) + "/" +
				     user_uploaded_images.length + ") " +
				     current_image_filename);
		show_annotation_info("[" + bounding_box_count + "] boxes and [" +
				     annotation_count + "] annotations");
		show_status("Press <span style='color:red;'>Enter</span> key to annotate," +
                            " <span style='color:red'>Arrow keys</span> to move to next image.");
		
            }
        }
        e.preventDefault();
    }
    if ( e.which == 46 ) { // Del
	if ( current_selected_bounding_box_index != -1 ) {
	    x0[current_image_filename].splice(current_selected_bounding_box_index, 1);
	    y0[current_image_filename].splice(current_selected_bounding_box_index, 1);
	    x1[current_image_filename].splice(current_selected_bounding_box_index, 1);
	    y1[current_image_filename].splice(current_selected_bounding_box_index, 1);

	    canvas_x0[current_image_filename].splice(current_selected_bounding_box_index, 1);
	    canvas_y0[current_image_filename].splice(current_selected_bounding_box_index, 1);
	    canvas_x1[current_image_filename].splice(current_selected_bounding_box_index, 1);
	    canvas_y1[current_image_filename].splice(current_selected_bounding_box_index, 1);

	    annotations[current_image_filename].splice(current_selected_bounding_box_index, 1);
	    
	    annotation_count = annotation_count - 1;
	    current_selected_bounding_box_index = -1;
	    redraw_image_canvas();
	}
    }
    
    if ( e.which == 27 ) { // Esc
	if ( user_entering_annotation ) {
            // exit bounding box annotation model
            annotation_textbox.style.visibility = "hidden";
            current_annotation_bounding_box_id = -1;
            user_entering_annotation = false;
	}

	if ( is_user_resizing_bounding_box ) {
	    // cancel bounding box resizing action
	    is_user_resizing_bounding_box = false;
	}
	
	if ( current_selected_bounding_box_index != -1 ) {
	    // clear all bounding box selection
	    current_selected_bounding_box_index = -1;
	}

	if ( zoom_active ) {
            zoom_active=false;
	}
	
	redraw_image_canvas();
	show_status("Press <span style='color:red;'>Enter</span> key to annotate," +
                    " <span style='color:red'>Arrow keys</span> to move to next image.");	
    }
    if ( e.which == 39 ) { // right arrow
        move_to_next_image();
    }
    if ( e.which == 37 ) { // left arrow
        move_to_prev_image();
    }
    if ( e.which == 121 ) { // F10 key used for debugging
        print_current_annotations();
    }
    if ( e.which == 90 ) { // z used to toggle zoom
	if ( zoom_active ) {
            zoom_active=false;
	    show_status("Press <span style='color:red;'>Enter</span> key to annotate," +
			" <span style='color:red'>Arrow keys</span> to move to next image.");
	} else {
	    zoom_active=true;
	    show_status("Zoom Enabled ( Press <span style='color:red;'>z</span> toggle zoom )");
	}
	redraw_image_canvas();
    }
    if ( e.which == 36 ) { // Home
	home_button.click();
    }
    if ( e.which == 112 ) { // F1 for help
	help_button.click();
    }
    
});

function move_to_prev_image() {
    if ( user_uploaded_images != null ) {
        if ( user_entering_annotation) {
            user_entering_annotation = false;
            annotation_textbox.style.visibility = "hidden";
            current_annotation_bounding_box_id = -1;
        }
        image_canvas.style.display = "none";
        image_context.clearRect(0, 0, image_canvas.width, image_canvas.height);
        
        if ( current_image_index == 0 ) {
            load_local_file(user_uploaded_images.length - 1);
        } else {
            load_local_file(current_image_index - 1);
        }
    }    
}

function move_to_next_image() {
    if ( user_uploaded_images != null ) {

        if ( user_entering_annotation) {
            user_entering_annotation = false;
            annotation_textbox.style.visibility = "hidden";
            current_annotation_bounding_box_id = -1;
        }
        image_canvas.style.display = "none";

        image_context.clearRect(0, 0, image_canvas.width, image_canvas.height);
        if ( current_image_index == (user_uploaded_images.length - 1) ) {
            load_local_file(0);
        } else {
            load_local_file(current_image_index + 1);
        }
    }
}

function check_local_storage() {
    // https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API/Using_the_Web_Storage_API
    try {
	var x = '__storage_test__';
	localStorage.setItem(x, x);
	localStorage.removeItem(x);
	return true;
    }
    catch(e) {
	return false;
    }
}

function show_status(msg) {
    status_bar.innerHTML = msg;
}

function show_navigation_info(msg) {
    navigation_info.innerHTML = msg;
}

function show_annotation_info(msg) {
    annotation_info.innerHTML = msg;
}

function show_info(msg) {
    info_bar.innerHTML = msg;
}

function parse_annotation_str(str) {
    // key1=val1;key2=val2;...
    // <span style='color:blue;'>key1</span>=<span style='color:black;'>val1</span> ; ...
    var m = str2map(str);
    if ( m.size == 0 ) {
	return str;
    } else {
	var html_str = "";
	for ( let attribute of annotation_attributes ) {
	    if ( m.has(attribute) ) {
		html_str = html_str + "<span style='color:" + COLOR_KEY + ";'>" + attribute + "</span> = ";
		html_str = html_str + "<span style='color:" + COLOR_VALUE + ";'>" + m.get(attribute) + "</span> ; ";
	    } else {
		html_str = html_str + "<span style='color:" + COLOR_KEY + ";'>" + attribute + "</span> = ";
		html_str = html_str + "<span style='color:" + COLOR_MISSING_VALUE + ";'>N/A</span> ; ";
	    }
	}
	return html_str;
    }
}

function str2map(str) {
    var m = new Map();
    var tokens = str.split(";");
    if ( tokens.length == 1 ) {
	var kv_split = str.split("=");
	if ( kv_split.length == 2 ) {
	    // a single key=value may be present
	    m.set(kv_split[0], kv_split[1]);
	} else {
	    if ( annotation_attributes.size == 1 &&
		 tokens[0].includes(";")) {
		for ( let attribute of annotation_attributes ) {
		    m.set(attribute, tokens[0]);
		}
	    }
	}
	return m;
    } else {
	if ( tokens.length == annotation_attributes.size &&
	     str.search("=") == -1 ) {
	    // user only entered the values : value1; value2; ...
	    var attr_i = 0;
	    for ( let attribute of annotation_attributes ) {
		m.set(attribute, tokens[attr_i]);
		attr_i = attr_i + 1;
	    }
	} else {
	    for ( var i=0; i < tokens.length; ++i) {
		var kvi = tokens[i];
		var kv_split = kvi.split("=");
		if ( kv_split.length > 1 ) {
		    m.set(kv_split[0], kv_split[1]);
		}
		else {
		    
		    // ignore malformed input
		    continue;
		}
	    }
	}
	return m;
    }
}

function print_current_annotations() {    
    for ( var i=0; i<image_filename_list.length; ++i) {
        var fn = image_filename_list[i];
        
        var logstr = "Showing annotations for file [" + fn + "] : ";
        logstr = logstr + "scale_factor=" + scale_factor[fn] + ", ";
        
        logstr = logstr + "x0/canvas_x0=[";
        for (var j=0; j<x0[fn].length; ++j) {
            logstr = logstr + Math.round(x0[fn][j]) + "/" + Math.round(canvas_x0[fn][j]) + ","
        }
        logstr = logstr + "] ";

        logstr = logstr + "y0=[";
        for (var j=0; j<y0[fn].length; ++j) {
            logstr = logstr + Math.round(y0[fn][j]) + "/" + Math.round(canvas_y0[fn][j]) + ","
        }
        logstr = logstr + "] ";
        
        logstr = logstr + "x1=[";
        for (var j=0; j<x1[fn].length; ++j) {
            logstr = logstr + Math.round(x1[fn][j]) + "/" + Math.round(canvas_x1[fn][j]) + ","
        }
        logstr = logstr + "] ";

        logstr = logstr + "y1=[";
        for (var j=0; j<y1[fn].length; ++j) {
            logstr = logstr + Math.round(y1[fn][j]) + "/" + Math.round(canvas_y1[fn][j]) + ","
        }
        logstr = logstr + "] ";
        
        logstr = logstr + "annotations=[";
        for (var j=0; j<annotations[fn].length; ++j) {
            logstr = logstr + annotations[fn][j] + ","
        }
        logstr = logstr + "]";
        
        console.log(logstr);
    }
}

function ImageAnnotation(filename, size) {
    this.filename = filename;
    this.size = size;
    this.description = "NA";
    this.image_region_list = [];
}

function ImageRegion(x0, y0, x1, y1, description) {
    this.x0 = Math.round(x0);
    this.y0 = Math.round(y0);
    this.x1 = Math.round(x1);
    this.y1 = Math.round(y1);
    this.description = description;
}

function get_image_id(filename, size) {
    return filename + size;
}

function init_image_annotation(filename, size) {
    var image_id = get_image_id(filename, size);
    if ( !image_annotation_list.has(image_id) ) {
	image_annotation_list[image_id] = new ImageAnnotation(filename, size);
    } else {
	
    }
    return image_id;
}

function add_image_region(image_id, x0, y0, x1, y1, description) {
    if( typeof description == "undefined" ) {
	description = '';
    }
    console.log("description=" + description);
    var r = new ImageRegion(x0, y0, x1, y1, description);
    var region_id = image_annotation_list[image_id].image_region_list.push(r);
    save_image_annotation_list();
    region_id = region_id - 1; // 0 based indexing
    return region_id;
}

function add_image_region_description(image_id, region_id, description) {
    console.log("description=" + description);
    image_annotation_list[image_id].image_region_list[region_id].description = description;
}

function save_image_annotation_list() {
    if ( is_local_storage_available ) {
	localStorage.setItem('image_annotation_list', JSON.stringify(image_annotation_list));
    }
}
