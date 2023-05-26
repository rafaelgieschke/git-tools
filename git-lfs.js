#!/bin/sh
//bin/sh -c :; command -v deno >/dev/null && exec deno run -A "$0" "$@"; exec node "$0" "$@"

// ./test.js download "$url" "$sha256sum" "$sizeBytes"
// ./test.js upload "$url" "$(sha256sum file|cut -d" " -f1)" "$(wc -c file|cut -d" " -f1)"

/*
url="$(git ls-remote --get-url)"
truncate -s 50GB file
./git-lfs.js "$url" upload a8a4a68becd624e1bec5f3336c21450fca28048509459094f80ffb5f14ccab5b 50000000000

truncate -s 51GB file
./git-lfs.js "$url" upload 7ddcf1fb1c74bf21d235a2c2eb50996ecbf112d82dc5ec38cf69f1550839b690 51000000000

truncate -s 100GB file
./git-lfs.js "$url" upload 20a02d68ac090c90dd03eb5ecf471e7200704e9fc982dbc86475188364b89f07 100000000000

./git-lfs.js "$url" download a8a4a68becd624e1bec5f3336c21450fca28048509459094f80ffb5f14ccab5b 50000000000
*/

// const url = "https://git:glpat-...@gitlab.example/group/project";
const [url, ...args] =
  globalThis.Deno?.args ?? globalThis.process?.argv.slice(2) ?? [];

const base = new URL(url);
base.pathname += ".git/info/lfs/";

// https://github.com/git-lfs/git-lfs/blob/main/docs/api/batch.md
// https://github.com/git-lfs/git-lfs/blob/main/docs/api/basic-transfers.md

const $$ = (v) => (console.dir(v, { depth: Infinity }), v);

Object.defineProperty(Object.prototype, "$$", {
  enumerable: false,
  get() {
    return $$(this.valueOf());
  },
});

globalThis.fetch = new Proxy(globalThis.fetch, {
  apply(target, thisArg, argArray) {
    const url = new URL(argArray[0]);
    const options = argArray[1] ?? {};
    if (!url.username && !url.password) {
      return Reflect.apply(target, thisArg, argArray);
    }
    options.headers ??= {};
    options.headers.authorization = `basic ${btoa(
      `${url.username}:${url.password}`
    )}`;
    url.username = "";
    url.password = "";
    return Reflect.apply(target, thisArg, [url, options]);
  },
});

const api = async (path, data) =>
  (
    await (
      await fetch(new URL(path, base), {
        method: "POST",
        headers: {
          accept: "application/vnd.git-lfs+json",
          "content-type": "application/vnd.git-lfs+json",
        },
        body: JSON.stringify(data),
      })
    ).json()
  ).$$;

const batch = async (operation, oid, size) => {
  const res = await api("objects/batch", {
    operation,
    objects: [
      {
        oid,
        size,
      },
    ],
    hash_algo: "sha256",
  });
  const req = res.objects[0].actions[operation];
  const auth = Object.entries(req.header)[0][1];
  const [username, password] = atob(auth.replace(/^\S+\s+/, "")).split(/:(.*)/);
  return String(Object.assign(new URL(req.href), { username, password }));
};

const curl = (url) =>
  `curl -v -Hcontent-type:application/octet-stream ${url} -o/dev/stdout -Tfile`;

console.log(curl(await batch(...args)));
