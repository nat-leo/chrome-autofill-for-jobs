import { BriefcaseBusiness, FileText, Sparkles } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert"

const profileSections = [
  {
    title: "Personal details",
    description: "Name, email, phone number, and location details that most forms ask first.",
    icon: FileText,
  },
  {
    title: "Work history",
    description: "Past employers, titles, dates, and achievements you want to reuse accurately.",
    icon: BriefcaseBusiness,
  },
  {
    title: "Reusable answers",
    description: "Responses for sponsorship, work authorization, salary, and remote-work questions.",
    icon: Sparkles,
  },
]

export default function JobAppInfo() {
  return (
    <div className="space-y-3">
      <Alert>
        <Sparkles className="size-4" />
        <AlertTitle>Job app info</AlertTitle>
        <AlertDescription>
          This section is ready for your saved application data. The structure is in place, but the form inputs and storage behavior still need to be implemented.
        </AlertDescription>
      </Alert>

      <div className="space-y-3">
        {profileSections.map(({ title, description, icon: Icon }) => (
          <Card key={title} size="sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Icon className="size-4 text-muted-foreground" />
                {title}
              </CardTitle>
              <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Add editable fields here when you are ready to capture and persist profile data.
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
