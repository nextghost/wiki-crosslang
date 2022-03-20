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

var slow_url = null;
var storage_prefix = 'wiki-crosslang-';

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
	let last_query = window.localStorage.getItem(storage_prefix + 'lastQuery');

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

		if (item.langcode.value === 'en') {
			slow_url = item.url.value;
		}
	}

	if (last_query) {
		let select1 = document.getElementById('lang1_id');
		let select2 = document.getElementById('lang2_id');
		last_query = JSON.parse(last_query);
		select1.value = last_query.header.srcLink;
		select2.value = last_query.header.dstLink;
	} else if (defurl) {
		elem1.value = defurl;
	}
}

function render_pagelist(header, pagelist) {
	let rowlist = [create_element('tr', [
		create_element('th', [header.srcName]),
		create_element('th', [header.dstName])
	])];

	for (let i = 0; i < pagelist.length; i++) {
		let item = pagelist[i];
		rowlist.push(create_element('tr', [
			create_element('td', [
				create_element('a', [item.srcName],
					{href:item.srcLink})
			]),
			create_element('td', [
				create_element('a', [item.dstName],
					{href:item.dstLink})
			]),
		]));
	}

	return create_element('table', rowlist);
}

function restore_pagelist() {
	let data = window.localStorage.getItem(storage_prefix + 'lastQuery');

	if (!data) {
		return;
	}

	data = JSON.parse(data);
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
	let field_list = ['srcLink', 'srcName', 'dstLink', 'dstName'];
	let pagelist = [];

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

		pagelist.push(tmp);
	}

	try {
		let cache_data = JSON.stringify({version: 1,
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
	let query = "SELECT ?srcLink ?srcName ?dstLink ?dstName WHERE {";
	let qurl1 = "?srcLink schema:isPartOf <" + baseurl1 + ">;\
		schema:name ?srcName;\
		schema:about ?item.";
	let qurl2 = "?dstLink schema:isPartOf <" + baseurl2 + ">;\
		schema:name ?dstName;\
		schema:about ?item.";

	// Performance optimization of the Wikidata SPARQL query
	if (baseurl1 === slow_url) {
		query += qurl2 + qurl1;
	} else {
		query += qurl1 + qurl2;
	}

	// Select only items which have a title. Not people or categories.
	query += "FILTER EXISTS {?item wdt:P1476 ?any}}";
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
