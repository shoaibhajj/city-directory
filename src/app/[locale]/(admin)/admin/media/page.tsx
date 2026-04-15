import { getPendingVideos } from "@/features/media/queries";
import { VideoModerationRow } from "./VideoModerationRow";
import { Video, CheckCircle, Clock } from "lucide-react";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/permissions";

export const metadata = { title: "مراجعة الفيديوهات | لوحة الإدارة" };

// Revalidate on every request — admin queues must always be fresh
export const dynamic = "force-dynamic";

export default async function AdminMediaPage({
  params,
}: {
  params: { locale: string };
}) {
  const session = await auth();
  if (!session?.user?.id || !isAdmin(session.user.role)) {
    redirect(`/${params.locale}/auth/sign-in` as never);
  }

  const pendingVideos = await getPendingVideos();

  return (
    <div className="space-y-6 p-4 md:p-6" dir="rtl">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Video className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">
              مراجعة الفيديوهات
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              الفيديوهات المرفوعة بانتظار الموافقة قبل النشر للعموم
            </p>
          </div>
        </div>

        {/* Badge count */}
        {pendingVideos.length > 0 && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 rounded-full text-sm font-medium">
            <Clock className="w-3.5 h-3.5" />
            {pendingVideos.length} بانتظار المراجعة
          </div>
        )}
      </div>

      {/* Empty state */}
      {pendingVideos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="p-4 rounded-full bg-green-100 dark:bg-green-900/30 mb-4">
            <CheckCircle className="w-10 h-10 text-green-600 dark:text-green-400" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">
            لا توجد فيديوهات بانتظار المراجعة
          </h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-xs">
            جميع الفيديوهات المرفوعة تمت مراجعتها — شكراً على متابعتك
          </p>
        </div>
      ) : (
        /* Moderation table */
        <div className="rounded-xl border border-border overflow-hidden bg-surface">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-offset border-b border-border">
                  <th className="text-right p-3 font-medium text-muted-foreground w-32">
                    معاينة
                  </th>
                  <th className="text-right p-3 font-medium text-muted-foreground">
                    المنشأة
                  </th>
                  <th className="text-right p-3 font-medium text-muted-foreground hidden md:table-cell">
                    صاحب الحساب
                  </th>
                  <th className="text-right p-3 font-medium text-muted-foreground w-20">
                    المدة
                  </th>
                  <th className="text-right p-3 font-medium text-muted-foreground hidden lg:table-cell w-28">
                    تاريخ الرفع
                  </th>
                  <th className="text-right p-3 font-medium text-muted-foreground w-36">
                    الإجراء
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {pendingVideos.map((video) => (
                  <VideoModerationRow key={video.id} video={video} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
