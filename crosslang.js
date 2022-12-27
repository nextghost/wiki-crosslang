/*
Wiki-crosslang - App for looking up bilingual texts on Wikisource
Copyright (C) 2019 next_ghost

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

var storage_prefix = 'wiki-crosslang-';
var crosslang_version = 2;

function load_last_query() {
	let data = window.localStorage.getItem(storage_prefix + 'lastQuery');

	if (!data) {
		return undefined;
	}

	data = JSON.parse(data);
	return (data.version == crosslang_version) ? data : undefined;
}

function process_langlist() {
	if (this.readyState !== XMLHttpRequest.DONE) {
		return;
	}

	let elem1 = document.getElementById('lang1_id');
	let elem2 = document.getElementById('lang2_id');
	let lang = get_preferred_lang();
	let defurl = null;

	if (this.status !== 200) {
		let elem = document.getElementById('results');
		elem.innerHTML = '';
		elem.appendChild(create_element('div',
			['Could not load list of Wikisource languages. Please reload the page.'],
			{class:'error'}));
		return;
	}

	let data = JSON.parse(this.responseText);
	let lang_list = data.results.bindings;
	let last_query = load_last_query();

	lang_list.sort(ws_langlist_cmp);

	for (idx in lang_list) {
		let item = lang_list[idx];
		let langname = titlecase(item.langname.value);
		elem1.add(create_element('option', [langname],
			{value:item.url.value}));
		elem2.add(create_element('option', [langname],
			{value:item.url.value}));

		if (item.langcode.value === lang) {
			defurl = item.url.value;
		}
	}

	if (last_query) {
		elem1.value = last_query.header.srcLink;
		elem2.value = last_query.header.dstLink;
	} else if (defurl) {
		elem1.value = defurl;
	}
}

function render_cell_links(linklist) {
	let ret = [];

	for (let i = 0; i < linklist.length; i++) {
		let item = linklist[i];

		ret.push(create_element('div', [
			create_element('a', [item.name], {href: item.link})
		]));
	}

	return ret;
}

function render_pagelist(header, pagelist) {
	let rowlist = [create_element('tr', [
		create_element('th', [header.srcName]),
		create_element('th', [header.dstName])
	])];

	for (let i = 0; i < pagelist.length; i++) {
		let item = pagelist[i];
		rowlist.push(create_element('tr', [
			create_element('td', render_cell_links(item.src)),
			create_element('td', render_cell_links(item.dst)),
		]));
	}

	return create_element('table', rowlist);
}

function restore_pagelist() {
	let data = load_last_query();

	if (!data) {
		return;
	}

	let date_opts = {dateStyle: 'short', timeStyle: 'short'};
	let query_date = new Date(data.date).toLocaleString('en', date_opts);
	let elem = document.getElementById('results');
	elem.innerHTML = '';
	elem.appendChild(create_element('div',
		['Previous query found ' + data.pagelist.length + ' works on ' + query_date + '. Press the button above to get fresh results.']));
	elem.appendChild(render_pagelist(data.header, data.pagelist));
}

function process_pagelist(xhr, header) {
	if (xhr.readyState !== XMLHttpRequest.DONE) {
		return;
	}

	let elem = document.getElementById('results');

	if (xhr.status !== 200) {
		elem.innerHTML = '';
		elem.appendChild(create_element('div',
			['Wikidata request failed. Please try again later.'],
			{class:'error'}));
		return;
	}

	let data = JSON.parse(xhr.responseText);
	let result_list = data.results.bindings;
	let field_list = ['work', 'link', 'name'];
	let linkmap = {};

	row_loop: for (let idx in result_list) {
		let item = result_list[idx];
		let tmp = {};

		for (let j in field_list) {
			let field = field_list[j];

			if (!item[field] || !item[field].value) {
				continue row_loop;
			}

			tmp[field] = item[field].value;
		}

		if (!linkmap[tmp.work]) {
			linkmap[tmp.work] = {src: [], dst: []};
		}

		if (tmp.link.startsWith(header.srcLink)) {
			linkmap[tmp.work].src.push(tmp);
		} else if (tmp.link.startsWith(header.dstLink)) {
			linkmap[tmp.work].dst.push(tmp);
		}
	}

	data = null;
	result_list = null;
	let pagelist = [];

	for (let idx in linkmap) {
		if (linkmap[idx].src.length && linkmap[idx].dst.length) {
			pagelist.push(linkmap[idx]);
		}
	}

	try {
		let cache_data = JSON.stringify({version: crosslang_version,
			date: new Date().getTime(), header: header,
			pagelist: pagelist});
		window.localStorage.setItem(storage_prefix + 'lastQuery',
			cache_data);
	} catch(err) {
		console.error('Cannot save query results to local storage: %s', err);
	}

	elem.innerHTML = '';
	elem.appendChild(create_element('div',
		['Found ' + pagelist.length + ' works.']));
	elem.appendChild(render_pagelist(header, pagelist));
}

function format_subquery(baseurl) {
	return "?link schema:isPartOf <" + baseurl + ">;\
		schema:name ?name;\
		schema:about/wdt:P629? ?work.\
		FILTER EXISTS {?work wdt:P1476 ?any}";
}

function submit_form() {
	let elem1 = document.getElementById('lang1_id');
	let elem2 = document.getElementById('lang2_id');
	let baseurl1 = elem1.value;
	let baseurl2 = elem2.value;
	let elem = document.getElementById('results');
	let swap = false;

	if (!baseurl1 || !baseurl2) {
		window.alert("Select both languages.");
		return;
	} else if (baseurl1 == baseurl2) {
		window.alert("Pick two different languages.");
		return;
	}

	let langname1 = elem1.options[elem1.selectedIndex].innerText;
	let langname2 = elem2.options[elem2.selectedIndex].innerText;
	let header = {srcLink: baseurl1, srcName: langname1, dstLink: baseurl2,
		dstName: langname2};

	// Select WikiSource pages available in both languages.
	// Ignore authors and WikiSource meta pages.
	let query = "SELECT ?work ?link ?name WHERE {{" +
		format_subquery(baseurl1) + "} UNION {" +
		format_subquery(baseurl2) + "}}";

	elem.innerHTML = 'Please wait. This may take a minute. Literally.';
	send_query(query, function() {
		process_pagelist(this, header);
	});
}

function init_page() {
	query_ws_langlist(process_langlist);
	restore_pagelist();
}

add_init_callback(init_page);
