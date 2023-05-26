console.log(await(async () => {
  const url = new URL(location);
  url.pathname = url.pathname.replace(/\/-\/.+$/, "");
  url.password = (await (await fetch(`${url}/-/settings/access_tokens`, {
    method: "POST",
    headers: {
      "x-csrf-token": document.querySelector("meta[name=csrf-token]").content
    },
    body: new URLSearchParams({
      "resource_access_token[name]": "test",
      "resource_access_token[access_level]": 50,
      "resource_access_token[scopes][]": "write_repository",
    }),
  })).json()).new_token;
  url.username = "git";
  return String(url);
})());
