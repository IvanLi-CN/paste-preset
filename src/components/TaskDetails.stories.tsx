import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import type { ImageInfo } from "../lib/types.ts";
import { TaskDetails } from "./TaskDetails";

const sampleImage = (overrides: Partial<ImageInfo> = {}): ImageInfo => {
  const blob = new Blob(["sample-image"], { type: "image/jpeg" });
  return {
    blob,
    url: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAkGBxISEhIQEBASEBAVDw8QDw8PDw8PFRAWFREWFhURExUYHSggGBolGxUVITEhJSkrLi4uFx8zODMtNygtLisBCgoKDg0OGxAQGy0lHyUtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLf/AABEIAKgBLAMBIgACEQEDEQH/xAAaAAEAAwEBAQAAAAAAAAAAAAAAAQIEBQMJ/8QAMhAAAQMDAgMHAwQDAAAAAAAAAQIDEQAEBRIhMQYTIkFRcRMUIyMyobHR8BQjQlJTYnL/xAAYAQEBAQEBAAAAAAAAAAAAAAAAAgEDBP/EABwRAQEAAwEAAwEAAAAAAAAAAAABEQIxEjFBYf/aAAwDAQACEQMRAD8A+3EREBERAREQEREBERAXwldwKqvM90+hULIbzCbl3o+SuvtVMMFIZJryDsafQnQZ9Ybp6HuXgPLZld0dfzpOwR21QZ/ROqHK/kiwyeCHB32WuTgn8kQ/wDM0wItom1L1JiPe5GyWrW8RLEym9dW+74zsJBHSzgnOS2fT9FdVxqq4m9pV3J2qYldF6dxHGmmd7Rd56Xbw3mO1snJJiCRKXk6rsR4sfKFxMVmuW3+cLmawV6Y5JR2HoOZEREBERAREQEREBERAREQEREH//Z",
    width: 1200,
    height: 800,
    mimeType: "image/jpeg",
    fileSize: blob.size,
    metadataStripped: false,
    metadata: {
      camera: "Fujifilm X-T5",
      lens: "XF 23mm F2",
      capturedAt: "2024-11-11 10:12",
      exposure: "1/200s",
      aperture: "f/2.8",
      iso: 200,
      focalLength: "23mm",
      location: { latitude: 35.6895, longitude: 139.6917 },
    },
    ...overrides,
  };
};

const meta = {
  title: "Components/TaskDetails",
  component: TaskDetails,
  tags: ["autodocs"],
  args: {
    onCopyResult: fn(),
    originalFileName: "photo.jpg",
  },
} satisfies Meta<typeof TaskDetails>;

export default meta;

type Story = StoryObj<typeof meta>;

export const SourceAndResult: Story = {
  args: {
    source: sampleImage({ metadataStripped: false, mimeType: "image/jpeg" }),
    result: sampleImage({
      mimeType: "image/png",
      metadataStripped: true,
      width: 1000,
      height: 700,
    }),
  },
};

export const ResultOnly: Story = {
  args: {
    source: null,
    result: sampleImage({
      mimeType: "image/webp",
      width: 1024,
      height: 576,
      metadataStripped: true,
    }),
  },
};
