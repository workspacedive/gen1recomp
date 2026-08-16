import { Navigation, Script } from "scripting"

import App from "./src/ui/app"

async function run(): Promise<void> {
  try {
    await Navigation.present({ element: <App /> })
  } finally {
    Script.exit()
  }
}

void run()
