# check_snippets.sh self-test fixture

Each block below is one case; selftest.sh compares the results with
snippets.expected (status, location, kind).

A plain block renders:

```d2
a -> b: ok
```

An unknown shape passes `d2 validate` but fails the render:

```d2
x: {shape: database}
```

A reserved keyword as an edge endpoint fails, with the expected message:

```d2-bad
# expect: reserved keywords are prohibited in edges
a -> left
```

A d2-bad block that renders is a failure of the doc:

```d2-bad
a -> right
```

A d2-bad block that fails for another reason than the expected one:

```d2-bad
# expect: reserved keywords are prohibited in edges
x: {shape: database}
```

A fragment is skipped even though it would not compile:

```d2
# fragment
  style.fill: "#FFFFFF"
}
```

cwd: resolves relative icon paths (and imports) from another directory:

```d2
# cwd: icons
api: API {icon: ./server.svg}
```

A missing cwd directory:

```d2
# cwd: no-such-dir
a -> b
```

1. An indented fence inside a list item is still checked:

   ```d2
   inside: In a list
   inside -> outside
   ```

A tilde fence and a multi-board block (renders a directory):

~~~d2
a -> b
steps: {
  s1: {b -> c}
}
~~~

An outer four-backtick fence hides the d2 block inside it (it is an
example of Markdown, not a snippet):

````markdown
```d2
this block is ignored: {shape: nope}
```
````

A four-backtick d2 fence may contain a three-backtick line:

````d2
doc: |md
  ```
  code
  ```
|
````

An uppercase info string counts as d2:

```D2
a -> b
```

An unclosed fence at the end of a file is reported:

```text
never closed
