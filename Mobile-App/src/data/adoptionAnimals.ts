import type { ImageSourcePropType } from "react-native";
import type { ShelterAnimal } from "../services/api";

export type AnimalType = "Dog" | "Cat" | "Other";

export type AdoptionAnimal = {
  id: string;
  name: string;
  type: AnimalType;
  age: string;
  sex: string;
  breed: string;
  color: string;
  size: string;
  energy: string;
  bestFor: string;
  location: string;
  vaccinated: boolean;
  personality: string[];
  story: string;
  image: ImageSourcePropType;
  images: ImageSourcePropType[];
};

type AnimalProfile = Omit<AdoptionAnimal, "image" | "images">;
type AnimalPhotoGroup = {
  id: string;
  type: "Dog" | "Cat";
  images: ImageSourcePropType[];
};

function createAnimal(profile: AnimalProfile, images: ImageSourcePropType[]): AdoptionAnimal {
  return {
    ...profile,
    image: images[0],
    images,
  };
}

const featuredAnimals: AdoptionAnimal[] = [
  createAnimal(
    {
      id: "buddy",
      name: "Buddy",
      type: "Dog",
      age: "3 years",
      sex: "Male",
      breed: "Mixed breed",
      color: "brown",
      size: "Large",
      energy: "Steady",
      bestFor: "Family rhythm",
      location: "Shelter yard",
      vaccinated: true,
      personality: ["Friendly", "Loyal", "Confident"],
      story: "Buddy is happiest next to people and has the easy charm of a dog who wants to belong.",
    },
    [require("../../assets/animals/dogs/101.jpeg")]
  ),
  createAnimal(
    {
      id: "milo",
      name: "Milo",
      type: "Cat",
      age: "8 months",
      sex: "Male",
      breed: "Domestic longhair",
      color: "ginger",
      size: "Small",
      energy: "Playful",
      bestFor: "Indoor homes",
      location: "Foster care",
      vaccinated: true,
      personality: ["Playful", "Curious", "Indoor"],
      story: "Milo is a bright kitten who settles quickly when he has a warm lap and a toy mouse nearby.",
    },
    [require("../../assets/animals/cats/105.jpeg")]
  ),
  createAnimal(
    {
      id: "luna",
      name: "Luna",
      type: "Cat",
      age: "2 years",
      sex: "Female",
      breed: "Domestic shorthair",
      color: "white",
      size: "Medium",
      energy: "Calm",
      bestFor: "Quiet spaces",
      location: "Shelter cattery",
      vaccinated: true,
      personality: ["Gentle", "Quiet", "Affectionate"],
      story: "Luna prefers calm homes and rewards patient people with soft head bumps and steady company.",
    },
    [require("../../assets/animals/cats/100.jpeg")]
  ),
  createAnimal(
    {
      id: "nova",
      name: "Nova",
      type: "Dog",
      age: "1 year",
      sex: "Female",
      breed: "Mixed breed",
      color: "golden",
      size: "Medium",
      energy: "Active",
      bestFor: "Training homes",
      location: "Kennel block A",
      vaccinated: true,
      personality: ["Energetic", "Smart", "Social"],
      story: "Nova loves training games and would thrive with someone who enjoys walks and routine.",
    },
    [require("../../assets/animals/dogs/107.jpeg")]
  ),
  createAnimal(
    {
      id: "coco",
      name: "Coco",
      type: "Dog",
      age: "5 years",
      sex: "Female",
      breed: "Mixed breed",
      color: "black",
      size: "Small",
      energy: "Low-key",
      bestFor: "Gentle routines",
      location: "Foster care",
      vaccinated: true,
      personality: ["Calm", "Cuddly", "Patient"],
      story: "Coco has gentle manners and is looking for a quieter home with soft beds and short strolls.",
    },
    [require("../../assets/animals/dogs/10.jpeg")]
  ),
  createAnimal(
    {
      id: "max",
      name: "Max",
      type: "Dog",
      age: "2 years",
      sex: "Male",
      breed: "Mixed breed",
      color: "brown",
      size: "Medium",
      energy: "Upbeat",
      bestFor: "Active people",
      location: "Kennel block B",
      vaccinated: true,
      personality: ["Happy", "Brave", "People-loving"],
      story: "Max greets new friends with a wagging tail and is ready for an active family rhythm.",
    },
    [require("../../assets/animals/dogs/118.jpeg")]
  ),
];

const catPhotoGroups: AnimalPhotoGroup[] = [
  { id: "cat-0", type: "Cat", images: [require("../../assets/animals/cats/0.jpeg")] },
  { id: "cat-1", type: "Cat", images: [require("../../assets/animals/cats/1.jpeg")] },
  { id: "cat-10", type: "Cat", images: [require("../../assets/animals/cats/10.jpeg")] },
  { id: "cat-104", type: "Cat", images: [require("../../assets/animals/cats/104.jpeg")] },
  { id: "cat-108", type: "Cat", images: [require("../../assets/animals/cats/108.jpeg")] },
  { id: "cat-11", type: "Cat", images: [require("../../assets/animals/cats/11.jpeg")] },
  {
    id: "cat-110",
    type: "Cat",
    images: [
      require("../../assets/animals/cats/110.jpeg"),
      require("../../assets/animals/cats/110-picture2.jpeg"),
      require("../../assets/animals/cats/110-picture3.jpeg"),
    ],
  },
  { id: "cat-112", type: "Cat", images: [require("../../assets/animals/cats/112.jpeg")] },
  { id: "cat-113", type: "Cat", images: [require("../../assets/animals/cats/113.jpeg")] },
  { id: "cat-115", type: "Cat", images: [require("../../assets/animals/cats/115.jpeg")] },
  { id: "cat-120", type: "Cat", images: [require("../../assets/animals/cats/120.jpeg")] },
  { id: "cat-121", type: "Cat", images: [require("../../assets/animals/cats/121.jpeg")] },
  { id: "cat-122", type: "Cat", images: [require("../../assets/animals/cats/122.jpeg")] },
  { id: "cat-123", type: "Cat", images: [require("../../assets/animals/cats/123.jpeg")] },
  { id: "cat-125", type: "Cat", images: [require("../../assets/animals/cats/125.jpeg")] },
  {
    id: "cat-128",
    type: "Cat",
    images: [
      require("../../assets/animals/cats/128.jpeg"),
      require("../../assets/animals/cats/128-pic2.jpeg"),
    ],
  },
  { id: "cat-131", type: "Cat", images: [require("../../assets/animals/cats/131.jpeg")] },
  { id: "cat-133", type: "Cat", images: [require("../../assets/animals/cats/133.jpeg")] },
  { id: "cat-134", type: "Cat", images: [require("../../assets/animals/cats/134.jpeg")] },
  { id: "cat-136", type: "Cat", images: [require("../../assets/animals/cats/136.jpeg")] },
  { id: "cat-14", type: "Cat", images: [require("../../assets/animals/cats/14.jpeg")] },
  { id: "cat-140", type: "Cat", images: [require("../../assets/animals/cats/140.jpeg")] },
  { id: "cat-141", type: "Cat", images: [require("../../assets/animals/cats/141.jpeg")] },
  { id: "cat-142", type: "Cat", images: [require("../../assets/animals/cats/142.jpeg")] },
  { id: "cat-143", type: "Cat", images: [require("../../assets/animals/cats/143.jpeg")] },
  { id: "cat-144", type: "Cat", images: [require("../../assets/animals/cats/105.jpeg")] },
  { id: "cat-145", type: "Cat", images: [require("../../assets/animals/cats/105.jpeg")] },
  { id: "cat-146", type: "Cat", images: [require("../../assets/animals/cats/105.jpeg")] },
  { id: "cat-147", type: "Cat", images: [require("../../assets/animals/cats/105.jpeg")] },
  { id: "cat-148", type: "Cat", images: [require("../../assets/animals/cats/105.jpeg")] },
  { id: "cat-149", type: "Cat", images: [require("../../assets/animals/cats/105.jpeg")] },
  { id: "cat-150", type: "Cat", images: [require("../../assets/animals/cats/105.jpeg")] },
  { id: "cat-151", type: "Cat", images: [require("../../assets/animals/cats/105.jpeg")] },
  { id: "cat-153", type: "Cat", images: [require("../../assets/animals/cats/105.jpeg")] },
  { id: "cat-154", type: "Cat", images: [require("../../assets/animals/cats/105.jpeg")] },
  { id: "cat-156", type: "Cat", images: [require("../../assets/animals/cats/105.jpeg")] },
  { id: "cat-158", type: "Cat", images: [require("../../assets/animals/cats/105.jpeg")] },
  { id: "cat-159", type: "Cat", images: [require("../../assets/animals/cats/105.jpeg")] },
  { id: "cat-16", type: "Cat", images: [require("../../assets/animals/cats/16.jpeg")] },
  { id: "cat-160", type: "Cat", images: [require("../../assets/animals/cats/105.jpeg")] },
  { id: "cat-162", type: "Cat", images: [require("../../assets/animals/cats/162.jpeg")] },
  { id: "cat-163", type: "Cat", images: [require("../../assets/animals/cats/163.jpeg")] },
  { id: "cat-164", type: "Cat", images: [require("../../assets/animals/cats/105.jpeg")] },
  { id: "cat-165", type: "Cat", images: [require("../../assets/animals/cats/105.jpeg")] },
  { id: "cat-166", type: "Cat", images: [require("../../assets/animals/cats/105.jpeg")] },
  { id: "cat-167", type: "Cat", images: [require("../../assets/animals/cats/105.jpeg")] },
  { id: "cat-168", type: "Cat", images: [require("../../assets/animals/cats/105.jpeg")] },
  { id: "cat-169", type: "Cat", images: [require("../../assets/animals/cats/105.jpeg")] },
  { id: "cat-17", type: "Cat", images: [require("../../assets/animals/cats/17.jpeg")] },
  { id: "cat-170", type: "Cat", images: [require("../../assets/animals/cats/105.jpeg")] },
  { id: "cat-171", type: "Cat", images: [require("../../assets/animals/cats/105.jpeg")] },
  { id: "cat-172", type: "Cat", images: [require("../../assets/animals/cats/105.jpeg")] },
  { id: "cat-174", type: "Cat", images: [require("../../assets/animals/cats/105.jpeg")] },
  { id: "cat-176", type: "Cat", images: [require("../../assets/animals/cats/105.jpeg")] },
  { id: "cat-177", type: "Cat", images: [require("../../assets/animals/cats/105.jpeg")] },
  { id: "cat-178", type: "Cat", images: [require("../../assets/animals/cats/105.jpeg")] },
  { id: "cat-abyssinian-1", type: "Cat", images: [require("../../assets/animals/cats/Abyssinian_1.jpg")] },
  { id: "cat-abyssinian-13", type: "Cat", images: [require("../../assets/animals/cats/Abyssinian_13.jpg")] },
  { id: "cat-abyssinian-31", type: "Cat", images: [require("../../assets/animals/cats/Abyssinian_31.jpg")] },
  { id: "cat-abyssinian-4", type: "Cat", images: [require("../../assets/animals/cats/Abyssinian_4.jpg")] },
  { id: "cat-abyssinian-47", type: "Cat", images: [require("../../assets/animals/cats/Abyssinian_47.jpg")] },
  { id: "cat-abyssinian-7", type: "Cat", images: [require("../../assets/animals/cats/Abyssinian_7.jpg")] },
  { id: "cat-abyssinian-8", type: "Cat", images: [require("../../assets/animals/cats/Abyssinian_8.jpg")] },
  { id: "cat-abyssinian-9", type: "Cat", images: [require("../../assets/animals/cats/Abyssinian_9.jpg")] },
  { id: "cat-bengal-35", type: "Cat", images: [require("../../assets/animals/cats/Bengal_35.jpg")] },
  { id: "cat-bengal-45", type: "Cat", images: [require("../../assets/animals/cats/Bengal_45.jpg")] },
  { id: "cat-bengal-52", type: "Cat", images: [require("../../assets/animals/cats/Bengal_52.jpg")] },
  { id: "cat-bengal-56", type: "Cat", images: [require("../../assets/animals/cats/Bengal_56.jpg")] },
  { id: "cat-bengal-61", type: "Cat", images: [require("../../assets/animals/cats/Bengal_61.jpg")] },
  { id: "cat-bengal-73", type: "Cat", images: [require("../../assets/animals/cats/Bengal_73.jpg")] },
  { id: "cat-bengal-80", type: "Cat", images: [require("../../assets/animals/cats/Bengal_80.jpg")] },
  { id: "cat-bengal-82", type: "Cat", images: [require("../../assets/animals/cats/Bengal_82.jpg")] },
  { id: "cat-bengal-85", type: "Cat", images: [require("../../assets/animals/cats/Bengal_85.jpg")] },
  { id: "cat-bengal-88", type: "Cat", images: [require("../../assets/animals/cats/Bengal_88.jpg")] },
  { id: "cat-birman-17", type: "Cat", images: [require("../../assets/animals/cats/Birman_17.jpg")] },
  { id: "cat-birman-3", type: "Cat", images: [require("../../assets/animals/cats/Birman_3.jpg")] },
  { id: "cat-bombay-10", type: "Cat", images: [require("../../assets/animals/cats/Bombay_10.jpg")] },
  { id: "cat-bombay-13", type: "Cat", images: [require("../../assets/animals/cats/Bombay_13.jpg")] },
  { id: "cat-bombay-32", type: "Cat", images: [require("../../assets/animals/cats/Bombay_32.jpg")] },
  { id: "cat-bombay-4", type: "Cat", images: [require("../../assets/animals/cats/Bombay_4.jpg")] },
  { id: "cat-bombay-5", type: "Cat", images: [require("../../assets/animals/cats/Bombay_5.jpg")] },
  { id: "cat-british-shorthair-22", type: "Cat", images: [require("../../assets/animals/cats/British_Shorthair_22.jpg")] },
  { id: "cat-british-shorthair-28", type: "Cat", images: [require("../../assets/animals/cats/British_Shorthair_28.jpg")] },
  { id: "cat-egyptian-mau-187", type: "Cat", images: [require("../../assets/animals/cats/Egyptian_Mau_187.jpg")] },
  { id: "cat-egyptian-mau-199", type: "Cat", images: [require("../../assets/animals/cats/Egyptian_Mau_199.jpg")] },
  { id: "cat-egyptian-mau-61", type: "Cat", images: [require("../../assets/animals/cats/Egyptian_Mau_61.jpg")] },
  { id: "cat-egyptian-mau-71", type: "Cat", images: [require("../../assets/animals/cats/Egyptian_Mau_71.jpg")] },
  { id: "cat-egyptian-mau-74", type: "Cat", images: [require("../../assets/animals/cats/Egyptian_Mau_74.jpg")] },
  { id: "cat-egyptian-mau-81", type: "Cat", images: [require("../../assets/animals/cats/Egyptian_Mau_81.jpg")] },
  {
    id: "cat-surrendered",
    type: "Cat",
    images: [require("../../assets/animals/cats/105.jpeg")],
  },
];

const dogPhotoGroups: AnimalPhotoGroup[] = [
  { id: "dog-100", type: "Dog", images: [require("../../assets/animals/dogs/100 .jpeg")] },
  { id: "dog-102", type: "Dog", images: [require("../../assets/animals/dogs/102.jpeg")] },
  { id: "dog-103", type: "Dog", images: [require("../../assets/animals/dogs/103.jpeg")] },
  { id: "dog-104", type: "Dog", images: [require("../../assets/animals/dogs/104.jpeg")] },
  { id: "dog-105", type: "Dog", images: [require("../../assets/animals/dogs/105.jpeg")] },
  { id: "dog-106", type: "Dog", images: [require("../../assets/animals/dogs/106.jpeg")] },
  { id: "dog-108", type: "Dog", images: [require("../../assets/animals/dogs/108.jpeg")] },
  { id: "dog-109", type: "Dog", images: [require("../../assets/animals/dogs/109.jpeg")] },
  { id: "dog-11", type: "Dog", images: [require("../../assets/animals/dogs/11.jpeg")] },
  { id: "dog-110", type: "Dog", images: [require("../../assets/animals/dogs/110.jpeg")] },
  { id: "dog-111", type: "Dog", images: [require("../../assets/animals/dogs/111.jpeg")] },
  { id: "dog-112", type: "Dog", images: [require("../../assets/animals/dogs/112.jpeg")] },
  { id: "dog-113", type: "Dog", images: [require("../../assets/animals/dogs/113.jpeg")] },
  { id: "dog-114", type: "Dog", images: [require("../../assets/animals/dogs/114.jpeg")] },
  { id: "dog-115", type: "Dog", images: [require("../../assets/animals/dogs/115.jpeg")] },
  { id: "dog-116", type: "Dog", images: [require("../../assets/animals/dogs/116.jpeg")] },
  { id: "dog-117", type: "Dog", images: [require("../../assets/animals/dogs/117.jpeg")] },
  { id: "dog-119", type: "Dog", images: [require("../../assets/animals/dogs/119.jpeg")] },
  { id: "dog-125", type: "Dog", images: [require("../../assets/animals/dogs/125.jpeg")] },
  { id: "dog-126", type: "Dog", images: [require("../../assets/animals/dogs/126.jpeg")] },
  { id: "dog-127", type: "Dog", images: [require("../../assets/animals/dogs/127.jpeg")] },
  { id: "dog-128", type: "Dog", images: [require("../../assets/animals/dogs/128.jpeg")] },
  { id: "dog-13", type: "Dog", images: [require("../../assets/animals/dogs/13.jpeg")] },
  { id: "dog-130", type: "Dog", images: [require("../../assets/animals/dogs/130.jpeg")] },
  { id: "dog-131", type: "Dog", images: [require("../../assets/animals/dogs/131.jpeg")] },
  { id: "dog-132", type: "Dog", images: [require("../../assets/animals/dogs/101.jpeg")] },
  { id: "dog-133", type: "Dog", images: [require("../../assets/animals/dogs/101.jpeg")] },
  { id: "dog-134", type: "Dog", images: [require("../../assets/animals/dogs/101.jpeg")] },
  { id: "dog-135", type: "Dog", images: [require("../../assets/animals/dogs/101.jpeg")] },
  { id: "dog-136", type: "Dog", images: [require("../../assets/animals/dogs/101.jpeg")] },
  { id: "dog-137", type: "Dog", images: [require("../../assets/animals/dogs/101.jpeg")] },
  { id: "dog-138", type: "Dog", images: [require("../../assets/animals/dogs/101.jpeg")] },
  { id: "dog-139", type: "Dog", images: [require("../../assets/animals/dogs/101.jpeg")] },
  { id: "dog-14", type: "Dog", images: [require("../../assets/animals/dogs/14.jpeg")] },
  { id: "dog-140", type: "Dog", images: [require("../../assets/animals/dogs/101.jpeg")] },
  { id: "dog-141", type: "Dog", images: [require("../../assets/animals/dogs/101.jpeg")] },
  { id: "dog-142", type: "Dog", images: [require("../../assets/animals/dogs/101.jpeg")] },
  { id: "dog-145", type: "Dog", images: [require("../../assets/animals/dogs/101.jpeg")] },
  { id: "dog-146", type: "Dog", images: [require("../../assets/animals/dogs/101.jpeg")] },
  { id: "dog-148", type: "Dog", images: [require("../../assets/animals/dogs/101.jpeg")] },
  { id: "dog-149", type: "Dog", images: [require("../../assets/animals/dogs/101.jpeg")] },
  { id: "dog-15", type: "Dog", images: [require("../../assets/animals/dogs/15.jpeg")] },
  { id: "dog-152", type: "Dog", images: [require("../../assets/animals/dogs/101.jpeg")] },
  { id: "dog-154", type: "Dog", images: [require("../../assets/animals/dogs/101.jpeg")] },
  { id: "dog-155", type: "Dog", images: [require("../../assets/animals/dogs/101.jpeg")] },
  { id: "dog-159", type: "Dog", images: [require("../../assets/animals/dogs/101.jpeg")] },
  { id: "dog-16", type: "Dog", images: [require("../../assets/animals/dogs/16.jpeg")] },
  { id: "dog-161", type: "Dog", images: [require("../../assets/animals/dogs/101.jpeg")] },
  { id: "dog-162", type: "Dog", images: [require("../../assets/animals/dogs/101.jpeg")] },
  { id: "dog-163", type: "Dog", images: [require("../../assets/animals/dogs/101.jpeg")] },
  { id: "dog-164", type: "Dog", images: [require("../../assets/animals/dogs/101.jpeg")] },
  { id: "dog-165", type: "Dog", images: [require("../../assets/animals/dogs/101.jpeg")] },
  { id: "dog-keeshond-93", type: "Dog", images: [require("../../assets/animals/dogs/keeshond_93.jpg")] },
  { id: "dog-leonberger-15", type: "Dog", images: [require("../../assets/animals/dogs/leonberger_15.jpg")] },
  { id: "dog-newfoundland-190", type: "Dog", images: [require("../../assets/animals/dogs/newfoundland_190.jpg")] },
  { id: "dog-newfoundland-2", type: "Dog", images: [require("../../assets/animals/dogs/newfoundland_2.jpg")] },
  { id: "dog-newfoundland-21", type: "Dog", images: [require("../../assets/animals/dogs/newfoundland_21.jpg")] },
  { id: "dog-pug-71", type: "Dog", images: [require("../../assets/animals/dogs/pug_71.jpg")] },
  { id: "dog-saint-bernard-64", type: "Dog", images: [require("../../assets/animals/dogs/saint_bernard_64.jpg")] },
  { id: "dog-samoyed-6", type: "Dog", images: [require("../../assets/animals/dogs/samoyed_6.jpg")] },
  { id: "dog-scottish-terrier-182", type: "Dog", images: [require("../../assets/animals/dogs/scottish_terrier_182.jpg")] },
  { id: "dog-scottish-terrier-188", type: "Dog", images: [require("../../assets/animals/dogs/scottish_terrier_188.jpg")] },
  { id: "dog-scottish-terrier-28", type: "Dog", images: [require("../../assets/animals/dogs/scottish_terrier_28.jpg")] },
  { id: "dog-shiba-inu-7", type: "Dog", images: [require("../../assets/animals/dogs/shiba_inu_7.jpg")] },
  { id: "dog-shiba-inu-76", type: "Dog", images: [require("../../assets/animals/dogs/shiba_inu_76.jpg")] },
  { id: "dog-shiba-inu-79", type: "Dog", images: [require("../../assets/animals/dogs/shiba_inu_79.jpg")] },
  { id: "dog-staffordshire-bull-terrier-194", type: "Dog", images: [require("../../assets/animals/dogs/staffordshire_bull_terrier_194.jpg")] },
  { id: "dog-staffordshire-bull-terrier-2", type: "Dog", images: [require("../../assets/animals/dogs/staffordshire_bull_terrier_2.jpg")] },
  { id: "dog-staffordshire-bull-terrier-23", type: "Dog", images: [require("../../assets/animals/dogs/staffordshire_bull_terrier_23.jpg")] },
  { id: "dog-staffordshire-bull-terrier-31", type: "Dog", images: [require("../../assets/animals/dogs/staffordshire_bull_terrier_31.jpg")] },
  { id: "dog-staffordshire-bull-terrier-41", type: "Dog", images: [require("../../assets/animals/dogs/staffordshire_bull_terrier_41.jpg")] },
  { id: "dog-staffordshire-bull-terrier-45", type: "Dog", images: [require("../../assets/animals/dogs/staffordshire_bull_terrier_45.jpg")] },
  { id: "dog-staffordshire-bull-terrier-46", type: "Dog", images: [require("../../assets/animals/dogs/staffordshire_bull_terrier_46.jpg")] },
  { id: "dog-staffordshire-bull-terrier-47", type: "Dog", images: [require("../../assets/animals/dogs/staffordshire_bull_terrier_47.jpg")] },
  { id: "dog-staffordshire-bull-terrier-5", type: "Dog", images: [require("../../assets/animals/dogs/staffordshire_bull_terrier_5.jpg")] },
  { id: "dog-staffordshire-bull-terrier-56", type: "Dog", images: [require("../../assets/animals/dogs/staffordshire_bull_terrier_56.jpg")] },
  { id: "dog-staffordshire-bull-terrier-59", type: "Dog", images: [require("../../assets/animals/dogs/staffordshire_bull_terrier_59.jpg")] },
  { id: "dog-staffordshire-bull-terrier-74", type: "Dog", images: [require("../../assets/animals/dogs/staffordshire_bull_terrier_74.jpg")] },
  { id: "dog-staffordshire-bull-terrier-78", type: "Dog", images: [require("../../assets/animals/dogs/staffordshire_bull_terrier_78.jpg")] },
  { id: "dog-staffordshire-bull-terrier-80", type: "Dog", images: [require("../../assets/animals/dogs/staffordshire_bull_terrier_80.jpg")] },
  { id: "dog-staffordshire-bull-terrier-85", type: "Dog", images: [require("../../assets/animals/dogs/staffordshire_bull_terrier_85.jpg")] },
  { id: "dog-staffordshire-bull-terrier-9", type: "Dog", images: [require("../../assets/animals/dogs/staffordshire_bull_terrier_9.jpg")] },
  { id: "dog-wheaten-terrier-15", type: "Dog", images: [require("../../assets/animals/dogs/wheaten_terrier_15.jpg")] },
  { id: "dog-yorkshire-terrier-99", type: "Dog", images: [require("../../assets/animals/dogs/yorkshire_terrier_99.jpg")] },
];

const animalNames: Record<"Dog" | "Cat", { female: string[]; male: string[] }> = {
  Cat: {
    female: [
      "Luna",
      "Bella",
      "Nala",
      "Willow",
      "Cleo",
      "Misty",
      "Ruby",
      "Poppy",
      "Hazel",
      "Ivy",
      "Mango",
      "Mabel",
      "Olive",
      "Suki",
      "Mochi",
      "Skye",
      "Maple",
      "Winnie",
      "Juniper",
      "Pearl",
      "Honey",
      "Sage",
      "Tofu",
      "Blossom",
      "Lyra",
      "Pixel",
      "Minnie",
      "Marble",
      "Dusty",
      "Echo",
      "Sunny",
      "Tilly",
      "Biscuit",
      "Clover",
      "Roxy",
      "Mia",
      "Lola",
      "Daisy",
      "Kiki",
      "Stella",
      "Mila",
      "Lily",
      "Rosie",
      "Dixie",
      "Zora",
      "Yara",
      "Yvette",
      "Nova",
      "Shadow",
      "Mimi",
    ],
    male: [
      "Cosmo",
      "Ghost",
      "Cricket",
      "Ginger",
      "Pepper",
      "Milo",
      "Oliver",
      "Leo",
      "Simba",
      "Jasper",
      "Theo",
      "Finn",
      "Oscar",
      "Ziggy",
      "Archie",
      "Felix",
      "Salem",
      "Smokey",
      "Domino",
      "Blue",
      "Ash",
      "Storm",
      "Peanut",
      "Beans",
      "Fudge",
      "Baxter",
      "Ollie",
      "Charlie",
      "Gizmo",
      "Rusty",
      "Rex",
      "Otis",
      "Max",
      "Buster",
      "Rocky",
      "Scout",
      "Chase",
      "Hugo",
      "Kai",
      "Bruno",
      "Duke",
      "Toby",
      "Ranger",
      "Sullivan",
      "Ace",
      "Cooper",
      "Diesel",
      "Zeke",
      "Teddy",
      "Bandit",
      "Sebastian",
      "Hudson",
      "Winston",
      "Rufus",
      "Atlas",
    ],
  },
  Dog: {
    female: [
      "Bailey",
      "Daisy",
      "Sadie",
      "Molly",
      "Rosie",
      "Ellie",
      "Kiki",
      "Maya",
      "Penny",
      "Zoe",
      "Amber",
      "Mia",
      "Harper",
      "Juno",
      "Stella",
      "Lola",
      "Layla",
      "Coco",
      "Indie",
      "Piper",
      "River",
      "Riley",
      "Violet",
      "Yara",
      "Scout",
      "Luna",
      "Nala",
      "Sasha",
      "Gracie",
      "Lulu",
      "Sophie",
      "Mabel",
      "Biscuit",
      "Clover",
      "Dixie",
      "Maple",
      "Nova",
      "Belle",
      "Pearl",
      "Georgia",
      "Skye",
      "Sierra",
      "Ruby",
      "Willow",
      "Ivy",
    ],
    male: [
      "Charlie",
      "Rocky",
      "Toby",
      "Bruno",
      "Jack",
      "Buster",
      "Rex",
      "Sam",
      "Rusty",
      "Chase",
      "Baxter",
      "Cooper",
      "Diesel",
      "Kona",
      "Loki",
      "Murphy",
      "Ranger",
      "Tank",
      "Ace",
      "Alfie",
      "Benji",
      "Cody",
      "Duke",
      "Frankie",
      "Gizmo",
      "Hugo",
      "Kai",
      "Otis",
      "Quinn",
      "Remy",
      "Rocco",
      "Thor",
      "Wally",
      "Buddy",
      "Max",
      "Milo",
      "Oliver",
      "Leo",
      "Simba",
      "Jasper",
      "Theo",
      "Oscar",
      "Finn",
      "Atlas",
      "Cash",
      "Zeus",
      "Rio",
      "Niko",
      "Bear",
      "Jax",
      "Cruz",
      "Zane",
      "Gus",
      "Teddy",
    ],
  },
};

type AnimalDefaults = {
  ages: string[];
  sexes: string[];
  breeds: string[];
  sizes: string[];
  energies: string[];
  bestFor: string[];
  locations: string[];
  personalities: string[][];
  storyAction: string;
};

const profileDefaults: Record<"Dog" | "Cat", AnimalDefaults> = {
  Cat: {
    ages: ["6 months", "1 year", "2 years", "3 years", "4 years", "8 months"],
    sexes: ["Female", "Male"],
    breeds: ["Domestic shorthair", "Domestic mediumhair", "Domestic longhair"],
    sizes: ["Small", "Medium"],
    energies: ["Calm", "Playful", "Curious", "Gentle"],
    bestFor: ["Indoor homes", "Quiet spaces", "Patient adopters", "Cozy routines"],
    locations: ["Shelter cattery", "Foster care", "Cat room", "Recovery suite"],
    personalities: [
      ["Gentle", "Curious", "Affectionate"],
      ["Playful", "Social", "Bright"],
      ["Quiet", "Patient", "Sweet"],
      ["Confident", "Calm", "People-friendly"],
    ],
    storyAction: "settle into a warm home with patient people and plenty of cozy corners",
  },
  Dog: {
    ages: ["9 months", "1 year", "2 years", "3 years", "4 years", "5 years"],
    sexes: ["Female", "Male"],
    breeds: ["Mixed breed", "Terrier mix", "Shepherd mix", "Labrador mix"],
    sizes: ["Small", "Medium", "Large"],
    energies: ["Steady", "Active", "Playful", "Low-key"],
    bestFor: ["Family rhythm", "Training homes", "Active people", "Gentle routines"],
    locations: ["Kennel block A", "Kennel block B", "Shelter yard", "Foster care"],
    personalities: [
      ["Friendly", "Trainable", "Social"],
      ["Loyal", "Curious", "Bright"],
      ["Happy", "People-loving", "Brave"],
      ["Gentle", "Patient", "Sweet"],
    ],
    storyAction: "find a steady routine, kind guidance, and a person who enjoys daily companionship",
  },
};

function pick<T>(items: T[], index: number) {
  return items[index % items.length];
}

const usedAnimalImages = new Set<string>();
const usedAnimalNames = new Set<string>();
const generatedNameCounts = new Map<string, number>();
let generatedFallbackIndex = 0;

function getAnimalImageKey(image?: ImageSourcePropType): string {
  if (!image) {
    return "";
  }

  if (typeof image === "number") {
    return String(image);
  }

  if (typeof image === "object" && "uri" in image && typeof image.uri === "string") {
    return image.uri.trim();
  }

  return JSON.stringify(image);
}

function buildUniqueDisplayName(baseName: string) {
  const normalizedBase = baseName.trim();
  const key = normalizedBase.toLowerCase();
  const count = generatedNameCounts.get(key) ?? 0;
  generatedNameCounts.set(key, count + 1);

  if (count === 0) {
    usedAnimalNames.add(key);
    return normalizedBase;
  }

  const nextName = `${normalizedBase} ${count + 1}`;
  usedAnimalNames.add(nextName.toLowerCase());
  return nextName;
}

function buildFallbackUniqueName(type: "Dog" | "Cat") {
  generatedFallbackIndex += 1;
  const fallbackName = `${type} ${generatedFallbackIndex}`;
  usedAnimalNames.add(fallbackName.toLowerCase());
  return fallbackName;
}

for (const animal of featuredAnimals) {
  if (animal.type === "Dog" || animal.type === "Cat") {
    const existingName = animal.name.trim();
    generatedNameCounts.set(existingName.toLowerCase(), (generatedNameCounts.get(existingName.toLowerCase()) ?? 0) + 1);
    usedAnimalNames.add(existingName.trim().toLowerCase());
    for (const image of animal.images) {
      usedAnimalImages.add(getAnimalImageKey(image));
    }
  }
}

function inferBreedFromPhotoGroup(type: "Dog" | "Cat", photoGroupId: string) {
  const normalized = photoGroupId.toLowerCase();
  const breedMap: Record<"Dog" | "Cat", Array<[RegExp, string]>> = {
    Cat: [
      [/abyssinian/, "Abyssinian"],
      [/bengal/, "Bengal"],
      [/birman/, "Birman"],
      [/bombay/, "Bombay"],
      [/british[_ -]?shorthair/, "British shorthair"],
      [/egyptian[_ -]?mau/, "Egyptian mau"],
      [/domestic.*longhair|longhair/, "Domestic longhair"],
      [/domestic.*mediumhair|mediumhair/, "Domestic mediumhair"],
      [/domestic.*shorthair|shorthair/, "Domestic shorthair"],
    ],
    Dog: [
      [/keeshond/, "Keeshond"],
      [/leonberger/, "Leonberger"],
      [/newfoundland/, "Newfoundland"],
      [/pug/, "Pug"],
      [/saint[_ -]?bernard/, "Saint Bernard"],
      [/samoyed/, "Samoyed"],
      [/scottish[_ -]?terrier/, "Scottish Terrier"],
      [/shiba[_ -]?inu/, "Shiba Inu"],
      [/staffordshire[_ -]?bull[_ -]?terrier/, "Staffordshire Bull Terrier"],
      [/wheaten[_ -]?terrier/, "Soft Coated Wheaten Terrier"],
      [/yorkshire[_ -]?terrier/, "Yorkshire Terrier"],
      [/terrier/, "Terrier mix"],
      [/shepherd/, "Shepherd mix"],
      [/labrador/, "Labrador mix"],
    ],
  };

  for (const [pattern, breed] of breedMap[type]) {
    if (pattern.test(normalized)) {
      return breed;
    }
  }

  return type === "Cat" ? "Domestic shorthair" : "Mixed breed";
}

function inferHairLabel(breed: string, type: "Dog" | "Cat") {
  const normalized = breed.toLowerCase();
  const longHairBreeds = [
    "keeshond",
    "samoyed",
    "soft coated wheaten terrier",
    "newfoundland",
    "saint bernard",
    "longhair",
    "birman",
    "abyssinian",
    "persian",
    "maine coon",
  ];

  if (longHairBreeds.some((candidate) => normalized.includes(candidate))) {
    return "Long-haired";
  }

  return type === "Cat" ? "Short-haired" : "Short-coated";
}

function inferColorFromBreed(type: "Dog" | "Cat", breed: string, index: number) {
  const normalized = breed.toLowerCase();

  if (normalized.includes("brown") || normalized.includes("chocolate") || normalized.includes("fawn")) {
    return "brown";
  }

  if (normalized.includes("black") || normalized.includes("ebony")) {
    return "black";
  }

  if (normalized.includes("white") || normalized.includes("cream") || normalized.includes("ivory")) {
    return "white";
  }

  if (normalized.includes("gold") || normalized.includes("golden")) {
    return "golden";
  }

  if (normalized.includes("grey") || normalized.includes("gray")) {
    return "grey";
  }

  if (normalized.includes("ginger") || normalized.includes("orange") || normalized.includes("amber")) {
    return "ginger";
  }

  const palette =
    type === "Cat" ? ["brown", "black", "white", "tabby", "ginger"] : ["brown", "black", "white", "golden", "grey"];

  return palette[Math.abs(index) % palette.length];
}

function buildUniqueAnimalsForType(type: "Dog" | "Cat"): AdoptionAnimal[] {
  const photoGroups = type === "Cat" ? catPhotoGroups : dogPhotoGroups;
  const femaleNames = [...new Set(animalNames[type].female)];
  const maleNames = [...new Set(animalNames[type].male)];
  const defaults = profileDefaults[type];
  const seenImages = new Set<string>();

  return photoGroups
    .filter((group) => {
      const key = getAnimalImageKey(group.images[0]);
      if (!key || seenImages.has(key)) {
        return false;
      }
      seenImages.add(key);
      return true;
    })
    .map((group, index) => {
      const breed = inferBreedFromPhotoGroup(type, group.id);
      const color = inferColorFromBreed(type, breed, index);
      const hairLabel = inferHairLabel(breed, type);
      const breedLabel = hairLabel === "Short-coated" || hairLabel === "Short-haired" ? breed : `${hairLabel} ${breed}`;
      const sex = index % 2 === 0 ? "Female" : "Male";
      const preferred = sex === "Female" ? femaleNames : maleNames;
      const available = preferred.filter((name) => !usedAnimalNames.has(name.trim().toLowerCase()));
      const chosenBase = available[0] ?? buildFallbackUniqueName(type);
      const chosenName = buildUniqueDisplayName(chosenBase);
      const image = group.images[0];

      usedAnimalImages.add(getAnimalImageKey(image));

      const profile: AnimalProfile = {
        id: group.id,
        name: chosenName,
        type,
        age: pick(defaults.ages, index),
        sex,
        breed: breedLabel,
        color,
        size: pick(defaults.sizes, index),
        energy: pick(defaults.energies, index),
        bestFor: pick(defaults.bestFor, index),
        location: pick(defaults.locations, index),
        vaccinated: true,
        personality: pick(defaults.personalities, index),
        story: `${chosenName} is a ${color} ${breedLabel.toLowerCase()} ${type.toLowerCase()} ready to ${defaults.storyAction}.`,
      };

      return createAnimal(profile, [image]);
    });
}

const moreAnimals = [
  ...buildUniqueAnimalsForType("Cat"),
  ...buildUniqueAnimalsForType("Dog"),
];

export const adoptionAnimals: AdoptionAnimal[] = [...featuredAnimals, ...moreAnimals];

export function getAdoptionAnimalById(id?: string) {
  return adoptionAnimals.find((animal) => animal.id === id);
}

function normalizeRemoteImageUri(uri: string) {
  // Android production builds reject cleartext URLs. Render is always available
  // over HTTPS even if an older API response was generated with an HTTP origin.
  return uri.replace(/^http:\/\/([^/]+\.onrender\.com)(\/|$)/i, "https://$1$2");
}

export function shelterAnimalToAdoptionAnimal(animal: ShelterAnimal): AdoptionAnimal {
  const bundledAnimal = getAdoptionAnimalById(animal.id);
  const remoteImages = (animal.images ?? [])
    .map((image) => image.dataUri?.trim())
    .filter((uri): uri is string => Boolean(uri))
    .map((uri) => ({ uri: normalizeRemoteImageUri(uri) }));

  // Seeded shelter records reference development-only /assets URLs. Their
  // matching photos are packaged with the app, so keep those stable when the
  // cloud response refreshes the animal details. Newly uploaded animals still
  // use their remote/data-URI images.
  const images =
    bundledAnimal?.images ??
    (remoteImages.length > 0
      ? remoteImages
      : [{ uri: normalizeRemoteImageUri(animal.imageDataUri) }]);

  const normalizedBreed = (animal.breed || "Mixed breed").trim();
  const breedColor = /brown|chocolate|fawn/i.test(normalizedBreed)
    ? "brown"
    : /black|ebony/i.test(normalizedBreed)
      ? "black"
      : /white|cream|ivory/i.test(normalizedBreed)
        ? "white"
        : /gold|golden/i.test(normalizedBreed)
          ? "golden"
          : /grey|gray|silver/i.test(normalizedBreed)
            ? "grey"
            : /ginger|orange|amber/i.test(normalizedBreed)
              ? "ginger"
              : "brown";

  return {
    id: animal.id,
    name: animal.name,
    type: animal.type,
    age: animal.age,
    sex: animal.sex,
    breed: normalizedBreed,
    color: breedColor,
    size: animal.size,
    energy: animal.energy,
    bestFor: animal.bestFor,
    location: animal.location,
    vaccinated: animal.vaccinated,
    personality: animal.personality,
    story: `${animal.name} is a ${breedColor} ${normalizedBreed.toLowerCase()} ${animal.type.toLowerCase()} ready for a loving home.`,
    image: images[0],
    images,
  };
}
