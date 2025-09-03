import { Request, Response } from "express";
import Chat from "../services/chat.service";

interface ChatMessageBody {
  text: string;
  media?: string;
  sent_user_id: string;
  chat_room_id: string;
  delivered_to?: string[];
  read_by?: string[];
  reaction?: Record<string, any>;
}

export const sendMessage = async (req: Request<{}, {}, ChatMessageBody>, res: Response): Promise<void> => {
  try {
    const {
      text,
      media,
      sent_user_id,
      chat_room_id,
      delivered_to,
      read_by,
      reaction,
    } = req.body;

    const chatMessage = new Chat({
      text,
      media,
      sent_user_id,
      chat_room_id,
      delivered_to,
      read_by,
      reaction: reaction || {},
    });

    const savedMessage = await chatMessage.saveMessage();

    res.status(201).json({
      success: true,
      message: "Message sent",
      data: savedMessage,
    });
  } catch (error) {
    console.error("Error sending message:", error);
    res.status(500).json({
      success: false,
      message: "Error sending message",
    });
  }
};

export const getMessagesByChatRoom = async (req: Request, res: Response): Promise<void> => {
  try {
    const { chat_room_id } = req.params as { chat_room_id: string };
    const messages = await Chat.getMessagesForRoom(chat_room_id);
    res.status(200).json({
      success: true,
      data: messages,
    });
  } catch (error) {
    console.error("Error fetching messages:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching messages",
    });
  }
};
