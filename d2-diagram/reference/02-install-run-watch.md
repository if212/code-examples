# Install, Run, Watch

## Install

```sh
curl -fsSL https://d2lang.com/install.sh | sh -s -- --dry-run
curl -fsSL https://d2lang.com/install.sh | sh -s -- --
d2 version
```

## Basic Run

```sh
d2 input.d2 out.svg
```

## Validate and Format

```sh
d2 validate input.d2
d2 fmt input.d2
```

## Watch Mode

```sh
d2 -w input.d2 out.svg
d2 -w --host localhost --port 3000 input.d2 out.svg
d2 -w --browser 0 input.d2 out.svg
```

## Useful Discovery Commands

```sh
d2 themes
d2 layout
d2 layout dagre
```
