# Formatting — how the toolbar works

LinkedIn gives you one font and no formatting buttons. grip-post works around
that by swapping your letters for Unicode characters that *look* formatted —
a "bold" A is `𝗔`, a genuinely different character that happens to be drawn
bold. LinkedIn stores it as ordinary text and shows it as-is.

That trick has real costs. They are set out at the bottom of this page, and
you should read them before styling a whole post.

## The one thing to know

**Select the words you want to change, then click a format. Only the selection
changes.** Select nothing and the whole post is formatted, which is what you
want when you have just pasted a draft and want all of it bolded.

Everything composes. Bold a phrase, italicise another, bullet the list
underneath — each click applies to the document the last one produced.

`Undo` and `Redo` work on the buttons or with `Cmd+Z` / `Ctrl+Z`. Every edit
is undoable, including `Clear`.

## What the groups do

**Style** changes the letters themselves: bold, italic, bold italic,
monospace, script, fraktur, double-struck, wide, underline, strikethrough,
superscript and subscript.

Two of these are worth calling out. **Superscript** turns digits into `¹²³`,
which is how you get footnote or citation markers into a post that has no
footnote feature. And **Plain** strips every style back to ordinary letters,
so you can change your mind — bold something, decide it should be italic,
hit Plain and then Italic rather than retyping it.

Superscript letters are patchy: Unicode simply has no superscript `q`, so any
letter without a superscript form is left alone rather than mangled.

**Wrap** puts something around the selection — corner brackets, a trailing
diamond, an arrow bullet — or joins a comma-separated list of names with
middle dots.

**Lists** turns the selected lines into a list. Eight bullet markers (dot,
arrow, triangle, square, check, star, dash, sparkle) and four numbering
styles (plain, circled `①`, filled `❶`, parenthesised). Blank lines are left
blank, because on LinkedIn they are what separates your paragraphs and a
bullet on an empty line just looks broken. Circled numerals run out at 20 and
filled at 10; past that the numbering falls back to plain digits rather than
printing an empty box.

Select any part of a line and the whole line is used — half a bulleted line
is not a thing.

**Blocks** are paragraph-level. **Quote** puts a `▏` rule down the left of
every line and a blank line above and below, so the passage reads as a
distinct block. **Indent** shifts lines right using figure spaces, because
LinkedIn collapses ordinary leading spaces and figure spaces survive.
**Strip prefix** removes one bullet, numeral, quote rule or indent per line,
so any of these is reversible.

**Art** generates something rather than transforming your text. Seven
dividers, a progress bar (`████████░░ 80%`), a sparkline from a list of
numbers (`▁▃▂█▅`), a star rating, and a callout box.

Type the input first, select it, then click: type `80`, select it, click
Progress. For the sparkline, type your numbers separated by commas.

The callout box deserves a note. LinkedIn renders posts in a proportional
font, so any ASCII box you draw collapses into a ragged mess in the feed.
grip-post renders the box contents in Unicode monospace, whose glyphs are
fixed-width, which is the only way the borders actually line up.

**Checks** read your post and answer in the box below. They never edit it.
Check fluff flags clichés, Strip AI tells shows the cleaned text, Ground
check flags claims with nothing behind them, and Metrics reports length and
styling. That separation is enforced in the code, not by convention: a check
is structurally incapable of writing into your draft.

## The honest trade-offs

**Screen readers cannot read styled letters.** To assistive technology `𝗔` is
a mathematical symbol, not the letter A. A wholly bolded post is unreadable
to a blind reader — not harder, unreadable. The panel warns you as the
proportion of styled characters climbs.

**LinkedIn's search will not match styled text.** If you bold the keyword you
most want to be found for, you have made yourself unfindable for it. Style
the words around it instead. The panel warns when styling appears in your
first line, which is where the keywords usually are.

**A few fonts show empty boxes.** Some older Android and desktop fonts lack
these Unicode blocks and render tofu squares. Most do not, but some do.

**Character counts are not what you expect.** A styled letter is one
character to a reader and two to most software. grip-post counts what a
reader sees, so the number under the input is the honest one.

The short version: style a phrase, not a post. Used on a heading or a key
line, this makes your writing scannable. Used on everything, it makes it
unreadable to some people and invisible to search.

## Where it works

The same toolbar ships three ways from one source: the Chrome side panel, a
Safari toolbar popup, and a plain web page needing no install. Formatted text
is ordinary characters, so it pastes into anything — LinkedIn, X, a CV, an
email subject line.
