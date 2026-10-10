/**
 * Fresh child environment, never an inherited credential/proxy/preload bag.
 * No PATH: the broker is launched with an absolute bundled runtime path.
 */
export function brokerChildEnvironment(source: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
    const clean: NodeJS.ProcessEnv = {};
    for (const name of ["SystemRoot", "WINDIR", "TEMP", "TMP", "TMPDIR", "LANG", "LC_ALL", "TZ"]) {
        const entry = Object.entries(source).find(([key]) => key.toLowerCase() === name.toLowerCase());
        if (entry?.[1]) clean[name] = entry[1];
    }
    return clean;
}
