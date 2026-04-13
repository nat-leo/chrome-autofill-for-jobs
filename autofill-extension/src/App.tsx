import { useState } from "react"

import FoundForms from "./pages/found-forms"
import JobAppInfo from "./pages/job-app-info"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/tabs"

export default function App() {
  const [activeTab, setActiveTab] = useState("found-forms")

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto flex w-full max-w-[430px] flex-col gap-3 p-3">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="found-forms">Read Forms</TabsTrigger>
            <TabsTrigger value="job-app-info">Job App Info</TabsTrigger>
          </TabsList>

          <TabsContent value="found-forms">
            <FoundForms />
          </TabsContent>

          <TabsContent value="job-app-info">
            <JobAppInfo />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
