window.onload = function() {
'use strict';

// ------------------------------------------------------------
// * Globals
// ------------------------------------------------------------

let saved = {}
let previous_visit_data = [PREVIOUS_VISIT_DATA]
let experimental_condition
let time_started = null
let buttons_assigned_to_callbacks = new Set()
let pyodide = null

let placeholder_names =
   {criterion: 'Criterion name',
    level: 'Level name',
    alt: 'Alternative name'}

// ------------------------------------------------------------
// * Helper functions
// ------------------------------------------------------------

let butlast = x =>
    Array.from(x).slice(0, -1)

let shuffle = function(array)
  // https://stackoverflow.com/a/12646864
   {for (let i = array.length - 1 ; i > 0 ; --i )
       {let j = Math.floor(Math.random() * (i + 1))
        let temp = array[i]
        array[i] = array[j]
        array[j] = temp}}

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

let show_scenario = function(id, criteria, alts)
   {E(id).innerHTML = ''
    E(id).append(
        newe('div', 'Criteria'),
        newe('ul', ...criteria.map(([name, levels]) =>
            newe('li', name, newe('ol', ...levels.map(
                x => newe('li', x)))))),
        newe('div', 'Alternatives'),
        newe('ul', ...alts.map(([name, xs]) =>
            newe('li', name, newe('ul', ...Array.from(xs.entries(), ([i, x]) =>
                newe('li', criteria[i][0] + ': ' + x)))))))}

let digest_evaluation_inputs = function(id)
   {for (let k of new Set(Array.from(
            document.querySelectorAll("#" + id + " input, #" + id + " textarea"))
            .map(x => x.name || x.id)))
       {let v
        if (k.startsWith('eval_desc_'))
            v = E(k).value.trim()
        else
           {v = document.querySelector('input[name="' + k + '"]:checked')
            if (v !== null)
                v = v.value}
        if (!v)
           {alert('Complete all the items before continuing.')
            return false}
        save(k, v)}
    return true}

// ------------------------------------------------------------
// * Startup
// ------------------------------------------------------------

let startup = function()
   {document.body.appendChild(newe('form'))
    document.body.lastChild.id = 'submission_form'
    E('submission_form').method = 'post'
    E('submission_form').action = [SUBMIT_URL]

    save('task_version', [TASK_VERSION])
    save('user_agent', window.navigator.userAgent)
    save('session', [SESSION_NUMBER])
    save('time_started_posixms', Date.now())
    time_started = performance.now()
    let visit = [VISIT_NUMBER]
    experimental_condition = [EXPERIMENTAL_CONDITION]

    load_vda(function(pyodide_obj)
      // Defined by Artiruno.
        {pyodide = pyodide_obj
         save('artiruno_commit',
             pyodide.runPython('artiruno.git_commit'))
         if (visit === 0)
           // The subject is here for the screening form.
             mode__consent()
         else if (visit === 1)
           // The subject is starting the real task.
             mode__problem_intro()
         else if (visit === 2)
           // The subject has just entered basic problem information and
           // been assigned a condition.
            {if (experimental_condition === 'vda')
                 mode__problem_setup()
             else
                 mode__demog()}
         else if (visit === 3)
           // The subject has returned after a month for the follow-up
           // session.
              mode__evaluation_either()
         else
              throw 'Illegal visit code.'})}

// ------------------------------------------------------------
// * Modes
// ------------------------------------------------------------

let mode__consent = function()
   {E('consent_form').addEventListener('submit', function(e)
       {e.preventDefault()
        if (/^\s*i\s*consent\s*$/i.test(E('consent_statement').value))
           {save('time_consented', time_elapsed())
            E('mode__consent').style.display = 'none'
            mode__screener()}})

    E('mode__consent').style.display = 'block'
    scroll_to_top()}

let mode__screener = function()
   {BC('screener_done', function()
       {let screener_has_problem = (
            document.querySelector('input[name="screener_has_problem"][value="true"]').checked
          ? true
          : document.querySelector('input[name="screener_has_problem"][value="false"]').checked
          ? false
          : null)
        let screener_problem_description = E('screener_problem_description').value.trim()
        let validation_error = (
            screener_has_problem === null
          ? 'Answer the yes-or-no question.'
          : screener_has_problem && !screener_problem_description
          ? 'Fill in the decision description.'
          : !screener_has_problem && screener_problem_description
          ? 'You said you had no such decision to make, so the description field should be blank.'
          : null)
        if (validation_error !== null)
           {alert(validation_error)
            return}
        save('screener_has_problem', screener_has_problem)
        save('screener_problem_description', screener_problem_description)
        E('mode__screener').style.display = 'none'
        mode__done()})

    E('mode__screener').style.display = 'block'
    scroll_to_top()}

let mode__problem_intro = function()
   {BC('problem_intro_done', function()
       {let validation_error = (
            !E('problem_description').value.trim()
          ? 'Fill in the decision description.'
          : !E('expected_resolution_date').value.trim()
          ? 'Fill in the expected outcome date.'
          : null)
        if (validation_error !== null)
           {alert(validation_error)
            return}
        save('problem_description', E('problem_description').value.trim())
        save('expected_resolution_date', E('expected_resolution_date').value.trim())
        save('time_problem_intro', time_elapsed())
        E('submission_form').submit()})

    E('mode__problem_intro').style.display = 'block'
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
                field(placeholder_names.level, regen),
                button('Delete this level', delete_parent_r)),
            this.parentElement)
        regen()}

    BC('new_criterion', function()
       {E('criteria_entry').insertBefore(
            newe('li',
                field(placeholder_names.criterion, regen),
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
                field(placeholder_names.alt),
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
            alts.length < 2
          ? 'You need at least two alternatives.'
          : alts.map(([name,]) => name).includes(placeholder_names.alt)
          ? 'Choose a name for each alternative.'
          : any_dupes(alts.map(([name,]) => name))
          ? 'No two alternatives can have the same name.'
          : criteria.length < 2
          ? 'You need at least two criteria.'
          : criteria.map(([name,]) => name).includes(placeholder_names.criterion)
          ? 'Choose a name for each criterion.'
          : any_dupes(criteria.map(([name,]) => name))
          ? 'No two criteria can have the same name.'
          : criteria.some(([, levels]) => levels.includes(placeholder_names.level))
          ? 'Choose a name for each level of each criterion.'
          : criteria.some(([, levels]) => levels.length < 2)
          ? 'Each criterion needs at least two levels.'
          : criteria.some(([, levels]) => any_dupes(levels))
          ? 'No two levels for a single criterion can have the same name.'
          : any_dupes(alts.map(([, values]) => JSON.stringify(values)))
          ? 'No two alternatives can have the same levels on all criteria.'
          : null)
        if (validation_error !== null)
           {alert(validation_error)
            return}
        save('criteria', criteria)
        save('alts', alts)
        if (!saved.hasOwnProperty('time_first_problem_setup'))
            save('time_first_problem_setup', time_elapsed())
        E('mode__problem_setup').style.display = 'none'
        mode__check_level_order()})

    E('mode__problem_setup').style.display = 'block'
    scroll_to_top()}

let already_checked = new Set()
let checking = null
let to_check = []

let mode__check_level_order = function()
   {to_check.length = 0
    // Put all pairs of adjacent criterion levels in `to_check`.
    for (let criterion of saved.criteria)
        for (let i = 0 ; i < criterion[1].length - 1 ; ++i)
           {let levels = [criterion[1][i], criterion[1][i + 1]]
            levels.sort()
            var x = [criterion, levels]
            if (!already_checked.has(JSON.stringify(x)))
                to_check.push(x)}
    shuffle(to_check)
    checking = null

    let next_pair = function()
       {if (!to_check.length)
          // All pairs have been checked. Continue with the task.
           {E('mode__check_level_order').style.display = 'none'
            mode__vda()
            return}

        checking = to_check.shift()
        let [criterion, levels] = checking
        for (let i of [0, 1])
            E('check_level_list').children[i].lastChild.textContent =
                criterion[0] + ': ' + levels[i]

        E('mode__check_level_order').style.display = 'block'}

    let made_choice = function()
       {let [criterion, levels] = checking
        if ((this.textContent === 'B') === (
                criterion[1].indexOf(levels[0]) <
                    criterion[1].indexOf(levels[1])))
          // The subject's choice was consistent with their earlier
          // criteria definitions. Continue.
           {already_checked.add(JSON.stringify(checking))
            next_pair()}
        else
           {alert("That selection isn't consistent with your earlier criterion definition. Remember, worse criterion levels should be listed first (i.e., higher in the list). Edit the levels as necessary.")
            E('mode__check_level_order').style.display = 'none'
            mode__problem_setup()}}

    BC('check_level_list_a', made_choice)
    BC('check_level_list_b', made_choice)

    next_pair()}

let mode__vda = function()
   {BC('return_to_problem_setup', async function()
       {await pyodide.runPythonAsync('artiruno.stop_web_vda()')
        E('mode__vda').style.display = 'none'
        mode__problem_setup()})

    show_scenario('display_subject_scenario', saved.criteria, saved.alts)

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

let mode__evaluation_either = function()
   {for (let k of ['problem_description', 'expected_resolution_date'])
        E('redisplay_' + k).textContent = JSON.parse(previous_visit_data[k])

    BC('evaluation_either_done', function()
       {if (!digest_evaluation_inputs('mode__evaluation_either'))
            return
        E('mode__evaluation_either').style.display = 'none'
        if (experimental_condition === 'vda')
            mode__evaluation_vda()
        else
            mode__debrief()})

    E('mode__evaluation_either').style.display = 'block'
    scroll_to_top()}

let mode__evaluation_vda = function()
   {show_scenario('redisplay_subject_scenario',
        JSON.parse(previous_visit_data.criteria),
        JSON.parse(previous_visit_data.alts))
    E('redisplay_vda_result').textContent =
        JSON.parse(previous_visit_data.vda_result)

    BC('evaluation_vda_done', function()
       {if (!digest_evaluation_inputs('mode__evaluation_vda'))
            return
        E('mode__evaluation_vda').style.display = 'none'
        mode__debrief()})

    E('mode__evaluation_vda').style.display = 'block'
    scroll_to_top()}

let mode__debrief = function()
   {save('time_started_debrief', time_elapsed())

    BC('debrief_done', function()
       {E('mode__debrief').style.display = 'none'
        mode__done()})

    E('mode__debrief').style.display = 'block'
    scroll_to_top()}

let mode__done = function()
   {save('time_done', time_elapsed())

    BC('done_done', function()
       {save('comments', E('comments').value.trim())
        E('submission_form').submit()})

    E('mode__done').style.display = 'block'
    scroll_to_top()}

startup()

}
