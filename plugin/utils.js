export const getDataId = (data) => {
  if (
    data.hasOwnProperty("hydra:view") &&
    data["hydra:view"].hasOwnProperty("@id")
  ) {
    return data["hydra:view"]["@id"];
  }
  if (data.hasOwnProperty("@id")) {
    return data["@id"];
  }
  return null;
};

export const isCollection = (value) =>
  value &&
  typeof value === "object" &&
  value.hasOwnProperty("@type") &&
  value["@type"] === "hydra:Collection";
