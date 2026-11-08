import type { SupabaseClient } from '@supabase/supabase-js'

type UploadResult = { path?: unknown }

export async function uploadEventManagerMedia(client: SupabaseClient, path: string, file: File): Promise<string> {
  const { data, error } = await client.functions.invoke<UploadResult>('upload-media', {
    body: file,
    headers: {
      'x-storage-bucket': 'event-manager-media',
      'x-storage-path': encodeURIComponent(path),
      'x-upload-size': String(file.size),
      'x-storage-upsert': 'false',
    },
  })

  if (error) {
    let message = error.message
    if ('context' in error && error.context instanceof Response) {
      try {
        const details: unknown = await error.context.clone().json()
        if (details && typeof details === 'object' && 'error' in details && typeof details.error === 'string') {
          message = details.error
        }
      } catch { /* Keep the original network or function error. */ }
    }
    throw new Error(message)
  }
  if (typeof data?.path !== 'string' || !data.path.startsWith(path.slice(0, path.lastIndexOf('/') + 1))) {
    throw new Error('Media upload returned an unexpected path.')
  }
  return data.path
}
