// component example
import { Text, Anchor, Space, Button, Title, TextInput } from "@mantine/core";
import { Trans, useTranslation } from "react-i18next";

import * as fs from "@tauri-apps/api/fs";
import * as tauriPath from "@tauri-apps/api/path";
import * as shell from "@tauri-apps/api/shell";
import { invoke } from "@tauri-apps/api/tauri";
import {
  APP_NAME,
  notify,
  RUNNING_IN_TAURI,
  useMinWidth,
  useStorage,
} from "../utils";
import { notifications } from "@mantine/notifications";
import { useTauriContext } from "../TauriProvider";
import { appWindow } from "@tauri-apps/api/window";
import { socket } from "../socket";
import { useCallback, useState } from "react";

function toggleFullscreen() {
  appWindow.isFullscreen().then((x) => appWindow.setFullscreen(!x));
}

export default function ExampleView(props) {
  const { isUserSelected, usersList, setUsersList, setIsUserSelected } = props;
  console.log(Object.entries(isUserSelected).length, usersList);
  const { t } = useTranslation();
  const { fileSep, loading, documents, downloads } = useTauriContext();
  // store-plugin will create necessary directories
  const storeName = `${documents}${APP_NAME}${fileSep}example_view.dat`;
  // const storeName = 'data.dat';
  const [data, setData, loadingData] = useStorage("exampleKey", "", storeName);
  const [message, setMessage] = useState("");
  useMinWidth(1000);
  const connectSocket = () => {
    socket.auth = { username: data };
    socket.connect();
  };

  const sendMessage = useCallback(() => {
    if (isUserSelected) {
      socket.emit("private message", {
        message,
        to: isUserSelected.userID,
      });

      // Create a new message object for the selected user
      const newMessage = { message, fromSelf: true };

      // Update the selected user's messages array
      const updatedSelectedUser = {
        ...isUserSelected,
        messages: [...isUserSelected.messages, newMessage],
      };

      // Update the selected user in the usersList state
      const updatedUsersList = usersList.map((user) =>
        user.userID === isUserSelected.userID ? updatedSelectedUser : user
      );

      // Update the state with the new message
      setUsersList(updatedUsersList);

      // Update the selected user state with the new message
      setIsUserSelected(updatedSelectedUser);
    }
  }, [message, isUserSelected, usersList]);
  // fs example
  async function createFile() {
    // run only in desktop/tauri env
    if (RUNNING_IN_TAURI) {
      // https://tauri.app/v1/api/js/modules/fs
      const filePath = `${downloads}/example_file.txt`;
      await fs.writeTextFile(
        "example_file.txt",
        "oh this is from TAURI! COOLIO.\n",
        { dir: fs.BaseDirectory.Download }
      );
      // show in file explorer: https://github.com/tauri-apps/tauri/issues/4062
      await shell.open(downloads);
      await invoke("process_file", { filepath: filePath }).then((msg) => {
        console.log(msg === "Hello from Rust!");
        notify("Message from Rust", msg);
        notifications.show({ title: "Message from Rust", message: msg });
      });
    }
  }
  // <> is an alias for <React.Fragment>
  return !loadingData && Object.entries(isUserSelected).length === 0 ? (
    <>
      <Text>{t("Modern Desktop App Examples")}</Text>
      <Space h={"md"} />
      <Button onClick={createFile}>Do something with fs</Button>
      <Space />
      <Button onClick={toggleFullscreen}>Toggle Fullscreen</Button>
      <Space />
      <Button
        onClick={() =>
          notifications.show({
            title: "Mantine Notification",
            message: "test v6 breaking change",
          })
        }
      >
        Notification example
      </Button>
      <Space />
      <TextInput
        label={t("Enter Your Name")}
        value={data}
        onChange={(e) => setData(e.currentTarget.value)}
      />
      <Space />
      <Button onClick={connectSocket}>Connect To Socket</Button>
      <Space />
      {/* <Title order={4}>{t('Interpolating components in translations')} </Title> */}
      {/* <Trans i18nKey='transExample'
            values={{ variable: '/elibroftw/modern-desktop-template' }}
            components={[<Anchor href="https://github.com/elibroftw/modern-desktop-app-template" />]}
            // optional stuff:
            default='FALLBACK if key does not exist. This template is located on <0>github.com{{variable}}</0>' t={t} />
        <TextInput label={t('Persistent data')} value={data} onChange={e => setData(e.currentTarget.value)} /> */}
    </>
  ) : (
    <>
      <TextInput
        label={t("Type a message")}
        aria-multiline
        value={message}
        onChange={(e) => setMessage(e.currentTarget.value)}
      />
      <Space />
      <Button onClick={sendMessage}>send message</Button>
      <Space />
      <ul>
        {isUserSelected.messages?.map((msg, index) => {
          const { message, fromSelf } = msg;
          return (
            <li key={index}>
              <Text
                style={{
                  textAlign: fromSelf ? "right" : "left",
                  color: fromSelf ? "#007BFF" : "#fff", // You can adjust the color based on the message sender
                  fontWeight: fromSelf ? 600 : 400, // You can adjust the font weight based on the message sender
                  marginBottom: 8, // Add some spacing between each message
                }}
              >
                {message}
              </Text>
            </li>
          );
        })}
      </ul>
    </>
  );
}
