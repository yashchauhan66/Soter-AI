# F10 native fixture Git and terminal-count addendum, not executed

The final authored primary count is now **16**, restart count **3**, total **19**.
Primary F10-H16 is the real Git fixture; restart ids are F10-H17 through H19.
Earlier freeze/review snapshots remain historical and are not overwritten.

Git setup runs only inside the new isolated synthetic workspace and profile.
The literal installed `C:\Program Files\Git\cmd\git.exe` must report exact
`git version 2.53.0.windows.1`. Three fixed finite setup invocations (version,
init, add) use `spawn` with shellfalse/windowsHidetrue, fresh minimal environment,
owned empty system/global config, hooks and init template. Output limits abandon
buffering while continuing to drain; setup resolves/rejects only after actual
close. No timeout, maxBuffer, kill, commit, history read/rewrite or network route
exists. All fixture/job bytes remain retained.

The unborn index contains only public `staged-public.txt` with one line. Its
worktree then gains extra unstaged sentinel lines and a distinct untracked
sentinel filename. Actual checked PTY `git status` must emit the staged-only
prefix plus `A` and that filename; actual `git diff --stat` must emit the same
prefix and exactly one insertion. Both must omit untracked filename and
unstaged content sentinels. This is a real version-pinned staged metadata check,
not worktree status coverage. Root executes after compile/build/review.

Native controller terminal counts are checked after actual provider terminal
creation, after fresh restart creation and after Git, against the host's captured
native terminal count. Cleanup closes each owned PTY and requires native status
to report zero remaining terminals before restoring API wrappers. The result
records `nativeTerminalsAfterClose`; no terminal count is inferred from mocks.

No native/build/compiler/check escalation was performed for this addendum. The
root owner runs the exact reviewed host and launcher. Functional10/security17
still require their separate same-artifact runs; this host's affected F09 task
smoke does not replace its entire historical task/debug suite. The same native
picker/human/external-agent/unmanaged-route limits from review01 remain.
