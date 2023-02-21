window.onload = function() {
'use strict';

// ------------------------------------------------------------
// * Globals
// ------------------------------------------------------------

let saved = {}
let previous_visit_data = [PREVIOUS_VISIT_DATA]
let prolific_pid_hex = [PROLIFIC_PID_HEX]
let experimental_condition
let time_started = null
let current_mode = null
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

let newe_c = function(x, className, ...kids)
   {x = newe(x, ...kids)
    x.className = className
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

let modes = {}

let mode = function(new_mode)
  // Change to the given mode.
   {if (current_mode)
        E('mode__' + current_mode).style.display = 'none'
    current_mode = new_mode
    modes[new_mode]()
    if (current_mode !== new_mode)
      // This function was called inside `modes[new_mode]` before it
      // returned, which means we're essentially skipping `new_mode`.
        return
    E('mode__' + new_mode).style.display = 'block'
    document.documentElement.scrollTop = 0}

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
    experimental_condition = 'vda'

    load_vda(function(pyodide_obj)
      // Defined by Artiruno.
        {pyodide = pyodide_obj
         save('artiruno_commit',
             pyodide.runPython('artiruno.git_commit'))
         if (visit === 0)
           // The subject is here for the screening form.
             mode('consent')
         else if (visit === 1)
           // The subject is starting the real task.
             mode('puzzle')
         else if (visit === 2)
           // The subject has just entered basic problem information and
           // been assigned a condition.
             mode(experimental_condition === 'vda'
               ? 'problem_setup'
               : 'demog')
         else if (visit === 3)
           // The subject has returned after a month for the follow-up
           // session.
              mode('evaluation_either')
         else
              throw 'Illegal visit code.'})}

// ------------------------------------------------------------
// * Modes
// ------------------------------------------------------------

modes.consent = function()
   {E('consent_form').addEventListener('submit', function(e)
       {e.preventDefault()
        if (/^\s*i\s*consent\s*$/i.test(E('consent_statement').value))
           {save('time_consented', time_elapsed())
            mode('screener')}})}

modes.screener = function()
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
        mode('done')})}

let puzzle_responses = []

modes.puzzle = function()
  // Make the subject complete a puzzle. They can only continue when
  // they get it right. The point is to encourage subjects who would
  // drop out if they were assigned to the VDA condition to drop out
  // earlier, before condition assignment.
   {let items = ['feather', 'ball', 'cup', 'hat']
    let possible_answers = [
      // Consider all permutations of {0, 1, 2, 3} except the ones
      // that begin with 0, so the answer doesn't resemble the problem
      // setup too much.
        [1, 0, 2, 3], [1, 0, 3, 2], [1, 2, 0, 3], [1, 2, 3, 0], [1, 3, 0, 2], [1, 3, 2, 0], [2, 0, 1, 3], [2, 0, 3, 1], [2, 1, 0, 3], [2, 1, 3, 0], [2, 3, 0, 1], [2, 3, 1, 0], [3, 0, 1, 2], [3, 0, 2, 1], [3, 1, 0, 2], [3, 1, 2, 0], [3, 2, 0, 1], [3, 2, 1, 0]]
    let clues = [[2, 3], [1, 0], [3, 1], [2, 1]]

    let answer = possible_answers[
      // Choose the correct answer pseudo-randomly using the subject's
      // PID.
        prolific_pid_hex.split('').reduce(
            (a, c) => a + parseInt(c, 16), 0) %
        possible_answers.length]
    let answer_str = answer.join('')
    save('puzzle_answer', answer_str)

    E('puzzle_objects_list').textContent =
        butlast(items).map(x => 'a ' + x).join(', ') +
        ', and a ' + items[items.length - 1]
    E('puzzle_objects_numbers').textContent =
        butlast(items).map((x, i) =>
            'the ' + x + ' as ' + i.toString()).join(', ') +
        ', and ' +
            'the ' + items[items.length - 1] + ' as ' + (items.length - 1).toString()

    for (let clue of clues)
        E('puzzle_clues').append(newe('li',
            'The ' + items[answer[clue[0]]] +
            ' is to the ' + (clue[0] < clue[1] ? 'left' : 'right') +
            ' of the ' + items[answer[clue[1]]] + '.'))

    BC('puzzle_done', function()
       {let response = E('puzzle_response').value.trim()
        puzzle_responses.push(response)
        let m = response.match(/[0-9]/g)
        if (m === null || m.join('') !== answer_str)
           {alert("That's not the right answer (or, you formatted your response incorrectly). Try again.")
            return}
        save('time_puzzle', time_elapsed())
        save('puzzle_responses', puzzle_responses)
        mode('problem_intro')})}

modes.problem_intro = function()
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
        E('submission_form').submit()})}

modes.problem_setup = function()
   {let delete_parent = function()
       {this.parentElement.remove()}
    let delete_parent_r = function()
       {this.parentElement.remove()
        regen()}

    let new_level = function()
       {this.parentElement.parentElement.insertBefore(
            newe('li',
                newe('span'),
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
                    newe_c('li', 'new_level_li',
                        button('Add a level', new_level)))),
            E('new_criterion_li'))
        regen()})

    let digest_criteria = () =>
        butlast(E('criteria_entry').children).map(c =>
           [c.firstChild.value.trim(),
            butlast(c.lastChild.children).map(v =>
                v.children[1].value.trim())])

    let regen = function(event, alt)
       {mark_levels()
        // Reset the criterion <select> elements for each alternative
        // (or only `alt`, if given).
        let criteria = digest_criteria()
        for (let e of butlast(E('alt_entry').children))
           {if (typeof alt !== 'undefined' && e !== alt)
                continue
            e.lastChild.innerHTML = ''
            e.lastChild.append(...criteria.map(([name, levels]) =>
                newe('li', name + ': ',
                    newe('select', ...levels.map(v =>
                        newe('option', v))))))}}

    let mark_levels = function()
      // Mark the best and worst levels of each criterion.
      // If there's only one level, mark it as the worst.
       {for (let criterion_list of E('mode__problem_setup')
                .getElementsByClassName('criteria'))
            for (let criterion of criterion_list.children)
                {if (criterion.id == 'new_criterion_li')
                     continue
                for (let level of criterion.getElementsByTagName('li'))
                   {if (level.className === 'new_level_li')
                        continue
                    if (level.firstChild.tagName !== 'SPAN')
                        level.insertBefore(newe('span'), level.firstChild)
                    let note = level.firstChild
                    note.textContent = ''
                    note.className = 'note'
                    if (level.previousSibling === null)
                       {note.textContent = '(worst)'
                        note.classList.add('worst')}
                    else if (level.nextSibling === null ||
                            level.nextSibling.className === 'new_level_li')
                       {note.textContent = '(best)'
                        note.classList.add('best')}}}}

    mark_levels()

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
        mode('check_dominance')})}

modes.check_dominance = function()
   {// Look for an alt that dominates all others. We need not check
    // for non-strict dominance (i.e., equality) because alts were
    // required to be distinct in an earlier step.
    let dominator = null
    let cs = saved.criteria
    CANDIDATE: for (let candidate of saved.alts)
       {for (let other of saved.alts)
           {if (other === candidate)
                continue
            for (let ci = 0 ; ci < cs.length ; ++ci)
                if (cs[ci][1].indexOf(other[1][ci]) >
                        cs[ci][1].indexOf(candidate[1][ci]))
                    continue CANDIDATE}
        dominator = candidate
        break CANDIDATE}

    if (!dominator)
       {save('dominance', false)
        return mode('vda')}

    for (let e of document.getElementsByClassName('dominator'))
        e.textContent = dominator[0]
    BC('return_to_problem_setup_1', function()
       {mode('problem_setup')})
    BC('check_dominance_done', function()
      // Skip the VDA proper, since the situation is trivial.
       {save('dominance', true)
        mode('demog')})}

modes.vda = function()
   {BC('return_to_problem_setup_2', async function()
       {await pyodide.runPythonAsync('artiruno.stop_web_vda()')
        mode('problem_setup')})

    show_scenario('display_subject_scenario', saved.criteria, saved.alts)

    pyodide.runPython('artiruno.initialize_web_interface')(
        'task', saved.criteria, saved.alts, time_started,
        function(questions, result)
           {save('vda_questions',
                questions.toJs({dict_converter: Object.fromEntries}))
            save('vda_result', result)
            E('dm').appendChild(button('Continue', function()
               {mode('demog')}))})}

modes.demog = function()
   {BC('demog_done', function()
       {let integer_item = function(id)
           {let x = E(id).value.trim()
            return /^\d+$/.test(x) ? Number(x) : null}
        let age = integer_item('age')
        let gender = document.querySelector('input[name="gender"]:checked')
        if (gender !== null)
           {gender = gender.value
            if (gender === 'other')
                gender = E('gender_other').value.trim()}
        let race = Array.from(
            document.querySelectorAll('input[id^=race_]')).map(x =>
               [x.id.replace(/^race_/, ''),
                x.id === 'race_other' ? x.value.trim() : x.checked])
        let education_years = integer_item('education_years')
        let validation_error = (
            age === null
          ? 'Provide your age in years as a whole number.'
          : !gender
          ? 'Provide your gender.'
          : !race.some(([, value]) => value)
          ? 'Provide your race.'
          : education_years === null
          ? 'Provide your years of education as a whole number.'
          : null)
        if (validation_error !== null)
           {alert(validation_error)
            return}
        save('country', E('country').value)
        save('age', age)
        save('gender', gender)
        save('race', race)
        save('education_years', education_years)
        mode('done')})}

modes.evaluation_either = function()
   {for (let k of ['problem_description', 'expected_resolution_date'])
        E('redisplay_' + k).textContent = JSON.parse(previous_visit_data[k])

    BC('evaluation_either_done', function()
       {if (!digest_evaluation_inputs('mode__evaluation_either'))
            return
        if (experimental_condition === 'vda')
            mode('evaluation_vda')
        else
            mode('debrief')})}

modes.evaluation_vda = function()
   {show_scenario('redisplay_subject_scenario',
        JSON.parse(previous_visit_data.criteria),
        JSON.parse(previous_visit_data.alts))
    E('redisplay_vda_result').textContent =
        JSON.parse(previous_visit_data.vda_result)

    BC('evaluation_vda_done', function()
       {if (!digest_evaluation_inputs('mode__evaluation_vda'))
            return
        mode('debrief')})}

modes.debrief = function()
   {save('time_started_debrief', time_elapsed())

    BC('debrief_done', function()
       {mode('done')})}

modes.done = function()
   {save('time_done', time_elapsed())

    BC('done_done', function()
       {save('comments', E('comments').value.trim())
        E('submission_form').submit()})}

startup()

}
