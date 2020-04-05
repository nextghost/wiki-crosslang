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

function process_langlist() {
	if (this.readyState !== XMLHttpRequest.DONE) {
		return;
	}

	let elem = document.getElementById('flang_id');
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

	for (idx in lang_list) {
		let item = lang_list[idx];
		let langname = titlecase(item.langname.value);
		elem.add(create_element('option', [langname],
			{value:item.url.value}));

		if (item.langcode.value === lang) {
			defurl = item.url.value;
		}
	}

	if (defurl) {
		elem.value = defurl;
	}
}

function render_pagelist(pagelist) {
	let rowlist = [create_element('tr', [
		create_element('th', ['Title']),
	])];

	for (let i = 0; i < pagelist.length; i++) {
		let item = pagelist[i];
		rowlist.push(create_element('tr', [
			create_element('td', [
				create_element('a', [item.name],
					{href:item.link})
			])
		]));
	}

	return create_element('table', rowlist);
}

function process_pagelist(xhr) {
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
	let field_list = ['link', 'name'];
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

	elem.innerHTML = '';
	elem.appendChild(create_element('div',
		['Found ' + pagelist.length + ' works.']));
	elem.appendChild(render_pagelist(pagelist));
}

function submit_form() {
	let flang = document.getElementById('flang_id');
	let ftitle = document.getElementById('ftitle_id').value.trim();
	let fauthor = document.getElementById('fauthor_id').value.trim();
	let fgenre = document.getElementById('fgenre_id').value.trim();
	let fsubject = document.getElementById('fsubject_id').value.trim();
	let baseurl = flang.value;
	let elem = document.getElementById('results');
	let subqs = [];
	let conds = [];
	let filters = [];

	if (!baseurl) {
		window.alert("Please select a language.");
		return;
	}

	if (fgenre) {
		subqs.push('{SELECT ?genre WHERE {\
			?genre wdt:P31 wd:Q223393;\
				rdfs:label?gname.\
			FILTER(CONTAINS(LCASE(STR(?gname)), LCASE("' +
			sparql_escape(fgenre) + '")))}}');
		conds.push('wdt:P136 ?genre');
	}

	if (ftitle) {
		conds.push('rdfs:label ?title');
		filters.push('FILTER(CONTAINS(LCASE(STR(?title)), LCASE("' +
			sparql_escape(ftitle) + '")))');
	}

	if (fauthor) {
		conds.push('wdt:P50 [ rdfs:label ?author ]');
		filters.push('FILTER(CONTAINS(LCASE(STR(?author)), LCASE("' +
			sparql_escape(fauthor) + '")))');
	}

	if (fsubject) {
		conds.push('wdt:P921 [ rdfs:label ?subject ]');
		filters.push('FILTER(CONTAINS(LCASE(STR(?subject)), LCASE("' +
			sparql_escape(fsubject) + '")))');
	}

	if (!conds.length) {
		window.alert("Please enter some search criteria.");
		return;
	}

	// Select WikiSource pages available in both languages.
	// Ignore authors and WikiSource meta pages.
	let query = "SELECT DISTINCT ?link ?name WHERE {\
		{SELECT ?class WHERE { ?class wdt:P279* wd:Q47461344. }}" +
		subqs.join('\n') +
		"?link schema:isPartOf <" + baseurl + ">;\
			schema:name ?name;\
			schema:about ?work.\
		?work wdt:P31 ?class;" + conds.join(';') + "." +
		filters.join('\n') + "} ORDER BY ASC(?name)";

	elem.innerHTML = 'Please wait. This may take a minute. Literally.';
	send_query(query, function() {
		process_pagelist(this);
	});
}

function init_page() {
	query_ws_langlist(process_langlist);
}

add_init_callback(init_page);
