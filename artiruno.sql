pragma journal_mode = 'wal';

create table Subjects(
    subject  integer primary key,
    contact  text not null);

create table Conditions(
    cn       integer primary key,
    subject  integer unique references Subjects(subject),
    cond     text not null);

create table Sessions(
    session        integer primary key,
    session_key    text not null unique,
    subject        integer references Subjects(subject),
    visit          integer not null,
    expires        integer not null,
    done           integer not null
        check (done in (0, 1)),
    paid_via       text);

create table TaskData(
    session  integer not null references Sessions(session),
    k        text not null,
    v        text not null,
    primary key (session, k));
