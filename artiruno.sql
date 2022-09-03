pragma journal_mode = 'wal';

create table Subjects(
    subject       integer primary key,
    prolific_pid  blob    unique);

create table Conditions(
    cn       integer primary key,
    subject  integer unique references Subjects(subject),
    cond     text not null);

create table ProlificStudies(
    prolific_study   blob primary key not null,
    completion_code  text not null);

create table Sessions(
    session          integer primary key,
    prolific_study   blob references ProlificStudies(prolific_study),
    subject          integer references Subjects(subject),
    visit            integer not null,
    done             integer not null
        check (done in (0, 1)));
create unique index SessionsSubjectVisit on Sessions(subject, visit);

create table TaskData(
    session  integer not null references Sessions(session),
    k        text not null,
    v        text not null,
    primary key (session, k));
