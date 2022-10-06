import { Address } from "../models";
import {
  Arg,
  Ctx,
  Mutation,
  Query,
  Resolver,
  UseMiddleware,
} from "type-graphql";
import { Context } from "../types";
import { isAuth } from "../middleware/isAuth";
import { AddressType } from "../models/Address";

@Resolver(Address)
export class AddressResolver {
  @Query(() => [Address])
  @UseMiddleware(isAuth)
  async getAddresses(@Ctx() { me }: Context): Promise<Address[]> {
    const addresses = await Address.findAll({ where: { userId: me.id } });

    return addresses;
  }

  @Query(() => Address)
  @UseMiddleware(isAuth)
  async getAddress(
    @Ctx() { me }: Context,
    @Arg("id") id: string
  ): Promise<Address> {
    const address = await Address.findOne({ where: { id, userId: me.id } });
    if (!address) throw new Error("Invalid id");
    return address;
  }

  @Mutation(() => Address)
  @UseMiddleware(isAuth)
  async createAddress(
    @Ctx() { me }: Context,
    @Arg("lineOne") lineOne: string,
    @Arg("lineTwo", { nullable: true }) lineTwo: string,
    @Arg("city") city: string,
    @Arg("state") state: string,
    @Arg("zipCode") zipCode: string,
    @Arg("type") type: AddressType
  ): Promise<Address> {
    const address = await Address.create({
      lineOne,
      lineTwo,
      city,
      state,
      zipCode,
      type,
      userId: me.id,
    });

    return address;
  }

  @Mutation(() => Address)
  @UseMiddleware(isAuth)
  async updateAddress(
    @Ctx() { me }: Context,
    @Arg("id") id: string,
    @Arg("lineOne", { nullable: true }) lineOne?: string,
    @Arg("lineTwo", { nullable: true }) lineTwo?: string,
    @Arg("city", { nullable: true }) city?: string,
    @Arg("state", { nullable: true }) state?: string,
    @Arg("zipCode", { nullable: true }) zipCode?: string
  ): Promise<Address> {
    const address = await Address.findOne({ where: { id, userId: me.id } });
    if (!address) throw new Error("Invalid id");

    if (lineOne !== undefined) address.lineOne = lineOne;
    if (lineTwo !== undefined) address.lineTwo = lineTwo;
    if (city !== undefined) address.city = city;
    if (state !== undefined) address.state = state;
    if (zipCode !== undefined) address.zipCode = zipCode;

    await address.save();

    return address;
  }

  @Mutation(() => Boolean)
  @UseMiddleware(isAuth)
  async deleteAddress(
    @Ctx() { me }: Context,
    @Arg("id") id: string
  ): Promise<boolean> {
    const quantity = await Address.destroy({ where: { id, userId: me.id } });
    return quantity > 0;
  }
}
