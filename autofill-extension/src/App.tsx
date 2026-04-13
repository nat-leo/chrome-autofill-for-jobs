import { Moon, Sun } from "lucide-react"
import { useEffect, useState } from "react"

import { Button } from "./components/ui/button"
import FoundForms from "./pages/found-forms"
import JobAppInfo from "./pages/job-app-info"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/tabs"

const THEME_STORAGE_KEY = "theme"

type Theme = "light" | "dark"

async function getStoredTheme(): Promise<Theme | null> {
  if (!chrome.storage?.local) return null

  const result = await chrome.storage.local.get(THEME_STORAGE_KEY)
  const value = result[THEME_STORAGE_KEY]
  return value === "dark" || value === "light" ? value : null
}

async function setStoredTheme(theme: Theme) {
  if (!chrome.storage?.local) return
  await chrome.storage.local.set({ [THEME_STORAGE_KEY]: theme })
}

export default function App() {
  const [activeTab, setActiveTab] = useState("found-forms")
  const [theme, setTheme] = useState<Theme>("light")
  const [hasLoadedTheme, setHasLoadedTheme] = useState(false)

  useEffect(() => {
    let cancelled = false

    void (async () => {
      const storedTheme = await getStoredTheme()
      if (cancelled) return

      if (storedTheme) {
        setTheme(storedTheme)
      } else {
        setTheme(window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
      }

      setHasLoadedTheme(true)
    })()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!hasLoadedTheme) return
    void setStoredTheme(theme)
  }, [hasLoadedTheme, theme])

  const toggleTheme = () => {
    setTheme((currentTheme) => (currentTheme === "dark" ? "light" : "dark"))
  }

  return (
    <div className={theme === "dark" ? "dark" : undefined}>
      <div className="min-h-screen bg-background text-foreground">
        <main className="mx-auto flex w-full max-w-[430px] flex-col gap-3 p-3">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <div className="flex items-center justify-between gap-2">
              <TabsList>
                <TabsTrigger value="found-forms">Read Forms</TabsTrigger>
                <TabsTrigger value="job-app-info">Job App Info</TabsTrigger>
              </TabsList>

              <Button
                aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                onClick={toggleTheme}
                size="icon-sm"
                type="button"
                variant="outline"
              >
                {theme === "dark" ? <Sun /> : <Moon />}
              </Button>
            </div>

            <TabsContent value="found-forms">
              <FoundForms />
            </TabsContent>

            <TabsContent value="job-app-info">
              <JobAppInfo />
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  )
}
