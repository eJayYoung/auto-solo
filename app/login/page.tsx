export default function LoginPage() {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-xl items-center justify-center px-4">
      <div className="w-full rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="space-y-3 text-center">
          <h1 className="text-3xl font-semibold text-slate-950">登录 auto-solo</h1>
          <p className="text-sm leading-6 text-slate-600">使用飞书账号登录后即可进入工作台、任务表、题库表和设置页。</p>
        </div>
        <div className="mt-8 flex justify-center">
          <a
            className="inline-flex items-center rounded-full bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
            href="/api/auth/feishu/start?redirectTo=/"
          >
            使用飞书登录
          </a>
        </div>
      </div>
    </div>
  );
}
