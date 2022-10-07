import {
  Arg,
  Field,
  Mutation,
  ObjectType,
  Query,
  Resolver,
  UseMiddleware,
} from "type-graphql";
import { v2 } from "cloudinary";
import { isAdmin } from "../middleware/isAdmin";
import { ProductImage } from "../models";

v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

@ObjectType()
class ImageUploadSignature {
  @Field()
  timestamp: number;

  @Field()
  signature: string;

  @Field()
  cloudname: string;

  @Field()
  apikey: string;
}

@Resolver(ProductImage)
export class ImageResolver {
  @Query(() => [String])
  @UseMiddleware(isAdmin)
  async imageUrls(): Promise<string[]> {
    const result = await v2.api.resources({
      prefix: "store",
      resource_type: "image",
      type: "upload",
      max_results: 500,
    });
    const urls = result.resources.map(
      (resource: { url: string }) => resource.url
    );
    return urls;
  }

  @Query(() => ImageUploadSignature)
  @UseMiddleware(isAdmin)
  imageUploadSignature(): ImageUploadSignature {
    const timestamp = Math.round(new Date().getTime() / 1000);
    const signature = v2.utils.api_sign_request(
      {
        timestamp: timestamp,
        folder: "store",
      },
      process.env.CLOUDINARY_API_SECRET
    );

    return {
      timestamp,
      signature,
      cloudname: process.env.CLOUDINARY_CLOUD_NAME,
      apikey: process.env.CLOUDINARY_API_KEY,
    };
  }

  @Mutation(() => ProductImage)
  @UseMiddleware(isAdmin)
  async attachImage(
    @Arg("productId") productId: string,
    @Arg("url") url: string,
    @Arg("primary") primary: boolean,
    @Arg("title", { nullable: true }) title: string,
    @Arg("description", { nullable: true }) description: string
  ): Promise<ProductImage> {
    let record = await ProductImage.findOne({
      where: { productId, url },
    });

    if (!record) {
      record = new ProductImage({ productId, url });
    }

    record.primary = primary;
    if (title !== undefined) record.title = title;
    if (description !== undefined) record.description = description;
    await record.save();

    return record;
  }

  @Mutation(() => Boolean)
  @UseMiddleware(isAdmin)
  async detachImage(@Arg("id") id: string): Promise<boolean> {
    const quantity = await ProductImage.destroy({ where: { id } });
    return quantity > 0;
  }
}
