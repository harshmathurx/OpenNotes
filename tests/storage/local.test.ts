import { runProviderTests } from "./provider-test-helpers"
import { LocalProvider } from "@/core/storage/local"
import { db } from "@/core/db/schema"

runProviderTests(
  "Local",
  () => new LocalProvider(),
  async () => {
    await db.delete()
    await db.open()
  }
)
