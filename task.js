window.onload = function() {
'use strict';

// ------------------------------------------------------------
// * Globals
// ------------------------------------------------------------

let saved = {}
let time_started = null
let buttons_assigned_to_callbacks = new Set()
let pyodide = null

// ------------------------------------------------------------
// * Helper functions
// ------------------------------------------------------------

let butlast = x =>
    Array.from(x).slice(0, -1)

let E = x =>
    document.getElementById(x)

let BC = function(x, f)
  // "Button callback"
   {if (!buttons_assigned_to_callbacks.has(x))
       {document.getElementById(x).addEventListener('click', f)
        buttons_assigned_to_callbacks.add(x)}}

let newe = function(x, ...kids)
   {x = document.createElement(x)
    x.append(...kids)
    return x}

let any_dupes = x =>
    (new Set(x)).size !== x.length

let field = function(initial, change_event)
   {let x = newe('input')
    x.value = initial
    if (typeof change_event !== undefined)
         x.addEventListener('change', change_event)
    return x}

let button = function(text, f)
   {let x = newe('button', text)
    x.addEventListener('click', f)
    x.type = 'button'
    return x}

let save = function(name, val)
   {let id = 'saved--' + name
    if (!E(id))
       {let e = newe('input')
        e.type = 'hidden'
        e.id = id
        e.name = name
        E('submission_form').appendChild(e)}
    saved[name] = val
    E(id).value = JSON.stringify(val)}

let scroll_to_top = function()
   {document.documentElement.scrollTop = 0}

let time_elapsed = () =>
    performance.now() - time_started

// ------------------------------------------------------------
// * Startup
// ------------------------------------------------------------

let startup = function()
   {save('task_version', [TASK_VERSION])
    save('user_agent', window.navigator.userAgent)
    save('subject_key', [SUBJECT_KEY])
    save('time_started_posixms', Date.now())
    time_started = performance.now()

    if (typeof turkSetAssignmentID == 'undefined')
       {E('submission_form').action = [SUBMIT_URL]}
    else
      // We're on MTurk.
       {turkSetAssignmentID()
        E('submission_form').action =
            turkGetSubmitToHost() + '/mturk/externalSubmit'}

    load_vda(function(pyodide_obj)
      // Defined by Artiruno.
        {pyodide = pyodide_obj
         save('artiruno_commit',
             pyodide.runPython('artiruno.git_commit'))
         mode__consent()})}

// ------------------------------------------------------------
// * Modes
// ------------------------------------------------------------

let mode__consent = function()
   {E('consent_form').addEventListener('submit', function(e)
       {e.preventDefault()
        if (/^\s*i\s*consent\s*$/i.test(E('consent_statement').value))
           {save('time_consented', time_elapsed())
            E('mode__consent').style.display = 'none'
            mode__problem_setup()}})

    E('mode__consent').style.display = 'block'
    scroll_to_top()}

let mode__problem_setup = function()
   {let delete_parent = function()
       {this.parentElement.remove()}
    let delete_parent_r = function()
       {this.parentElement.remove()
        regen()}

    let new_level = function()
       {this.parentElement.parentElement.insertBefore(
            newe('li',
                field('Level name', regen),
                button('Delete this level', delete_parent_r)),
            this.parentElement)
        regen()}

    BC('new_criterion', function()
       {E('criteria_entry').insertBefore(
            newe('li',
                field('Criterion name', regen),
                button('Delete this criterion', delete_parent_r),
                newe('ol',
                    newe('li', button('Add a level', new_level)))),
            E('new_criterion_li'))
        regen()})

    let digest_criteria = () =>
        butlast(E('criteria_entry').children).map(c =>
           [c.firstChild.value.trim(),
            butlast(c.lastChild.children).map(v =>
                v.firstChild.value.trim())])

    let regen = function(event, alt)
       {let criteria = digest_criteria()
        // Refresh the best-possible and worst-possible option displays.
        for (let ix of [0, -1])
           {E('possible-option-' + ix).innerHTML = ''
            E('possible-option-' + ix).append(...criteria.map(
                ([name, levels]) =>
                    newe('li', name + ': ' +
                        (levels.length ? levels.slice(ix)[0] : ''))))}
        // Reset the criterion <select> elements for each alternative
        // (or only `alt`, if given).
        for (let e of butlast(E('alt_entry').children))
           {if (typeof alt !== 'undefined' && e !== alt)
                continue
            e.lastChild.innerHTML = ''
            e.lastChild.append(...criteria.map(([name, levels]) =>
                newe('li', name + ': ',
                    newe('select', ...levels.map(v =>
                        newe('option', v))))))}}

    BC('new_alt', function()
       {E('alt_entry').insertBefore(
            newe('li',
                field('Alternative name'),
                button('Delete this alternative', delete_parent),
                newe('ul')),
            E('new_alt_li'))
        regen(null, E('new_alt_li').previousSibling)})

    let digest_alts = () =>
        butlast(E('alt_entry').children).map(a =>
           [a.firstChild.value.trim(),
            Array.from(a.lastChild.children).map(c =>
                c.lastChild.value.trim())])

    BC('problem_setup_done', function()
       {let criteria = digest_criteria()
        let alts = digest_alts()
        let validation_error = (
            !E('problem_description').value.trim()
          ? 'Fill in the decision description.'
          : !E('expected_resolution_date').value.trim()
          ? 'Fill in the expected outcome date.'
          : criteria.length < 2
          ? 'You need at least two criteria.'
          : any_dupes(criteria.map(([name,]) => name))
          ? 'No two criteria can have the same name.'
          : criteria.some(([, levels]) => levels.length < 2)
          ? 'Each criterion needs at least two levels.'
          : criteria.some(([, levels]) => any_dupes(levels))
          ? 'No two levels for a single criterion can have the same name.'
          : alts.length < 2
          ? 'You need at least two alternatives.'
          : any_dupes(alts.map(([name,]) => name))
          ? 'No two alternatives can have the same name.'
          : any_dupes(alts.map(([, values]) => JSON.stringify(values)))
          ? 'No two alternatives can have the same levels on all criteria.'
          : null)
        if (validation_error !== null)
           {alert(validation_error)
            return}
        save('problem_description', E('problem_description').value.trim())
        save('expected_resolution_date', E('expected_resolution_date').value.trim())
        save('criteria', criteria)
        save('alts', alts)
        if (!saved.hasOwnProperty('time_first_problem_setup'))
            save('time_first_problem_setup', time_elapsed())
        E('mode__problem_setup').style.display = 'none'
        mode__vda()})

    E('mode__problem_setup').style.display = 'block'
    scroll_to_top()}

let mode__vda = function()
   {BC('return_to_problem_setup', async function()
       {await pyodide.runPythonAsync('artiruno.stop_web_vda()')
        E('mode__vda').style.display = 'none'
        mode__problem_setup()})

    E('subject_scenario_display').innerHTML = ''
    E('subject_scenario_display').append(
        newe('div', 'Criteria'),
        newe('ul', ...saved.criteria.map(([name, levels]) =>
            newe('li', name, newe('ol', ...levels.map(
                x => newe('li', x)))))),
        newe('div', 'Alternatives'),
        newe('ul', ...saved.alts.map(([name, xs]) =>
            newe('li', name, newe('ul', ...Array.from(xs.entries(), ([i, x]) =>
                newe('li', saved.criteria[i][0] + ': ' + x)))))))

    pyodide.runPython('artiruno.initialize_web_interface')(
        'task', saved.criteria, saved.alts, time_started,
        function(questions, result)
           {save('vda_questions',
                questions.toJs({dict_converter: Object.fromEntries}))
            save('vda_result', result)
            E('dm').appendChild(button('Continue', function()
               {E('mode__vda').style.display = 'none'
                mode__demog()}))})

    E('mode__vda').style.display = 'block'
    scroll_to_top()}

let mode__demog = function()
   {BC('demog_done', function()
       {let age = E('age').value.trim()
        age = /^\d+$/.test(age) ? Number(age) : null
        let gender = document.querySelector('input[name="gender"]:checked')
        if (gender !== null)
           {gender = gender.value
            if (gender === 'other')
                gender = E('gender_other').value.trim()}
        let race = Array.from(
            document.querySelectorAll('input[id^=race_]')).map(x =>
               [x.id.replace(/^race_/, ''),
                x.id === 'race_other' ? x.value.trim() : x.checked])
        let validation_error = (
            age === null
          ? 'Provide your age in years as a whole number.'
          : !gender
          ? 'Provide your gender.'
          : !race.some(([, value]) => value)
          ? 'Provide your race.'
          : null)
        if (validation_error !== null)
           {alert(validation_error)
            return}
        save('country', E('country').value)
        save('age', age)
        save('gender', gender)
        save('race', race)
        E('mode__demog').style.display = 'none'
        mode__done()})

    E('mode__demog').style.display = 'block'
    scroll_to_top()}

let mode__done = function()
   {save('time_done', time_elapsed())
    E('mode__done').style.display = 'block'
    scroll_to_top()}

startup()

}
